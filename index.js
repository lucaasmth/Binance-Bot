const fs = require("fs");
const Discord = require('discord.js');
const Binance = require('node-binance-api');
const client = new Discord.Client();
const users = require('./users.json');
const schedule = require('node-schedule');

const prefix = "!";

client.on('ready', () => {
	console.log(`Logged in as ${client.user.tag}!`);
});

client.on('message', message => {
	if (!message.content.startsWith(prefix) || message.author.bot) return;

	const args = message.content.slice(prefix.length).trim().split(' ');
	const command = args.shift().toLowerCase();


	if (command === "register") {
		if(args.length != 2) {
			message.channel.send("Vous devez entrer votre clé d'API et votre clé secrete");
			return;
		}

		//Getting balance to verify keys
		const binance = new Binance().options({
			APIKEY: args[0],
			APISECRET: args[1]
		});
		binance.balance(err => {
			if (err) {
				message.channel.send("Une erreur est survenue, peut-être que vos clés sont invalides.");
			} else {
				users[message.author.id] = { apiKey: args[0], secret: args[1] };
				fs.writeFile("./users.json", JSON.stringify(users, null, 4), (err) => {
					if (err) message.channel.send("Erreur lors de l'inscription de la clé d'API");
					else message.channel.send("Vous êtes maintenant inscrit!");
				});
			}
		});
	} else if (command === "logout") {
		//On vérifie si l'utilisateur est déjà inscrit
		if (users[message.author.id] === undefined || users[message.author.id] === null) {
			message.channel.send("Vous n'êtes pas inscrit.");
			return;
		}

		users[message.author.id] = null;
		fs.writeFile("./users.json", JSON.stringify(users, null, 4), (err) => {
			if (err) message.channel.send("Erreur lors de la désinscription");
			else message.channel.send("Vous êtes maintenant désinscrit!");
		});
	} else {
		const binance = new Binance().options({
			APIKEY: users[message.author.id].apiKey,
			APISECRET: users[message.author.id].secret
		});

		if (command === "balance") {
			binance.balance(async (err, balances) => {
				if (err) {
					message.channel.send("Une erreur est survenue, peut-être que vos clés sont invalides.");
				} else {
					//On trie la balance + enleve les 0
					balances = orderJson(balances);
					let prices = await binance.prices();
					let total = 0;
					const responseEmbed = new Discord.MessageEmbed()
						.setTitle(`${message.author.username}'s balance`)
					for (coin in balances) {
						let price = undefined;
						if (coin.startsWith("LD")) {
							price = prices[coin.slice("LD".length) + "USDT"];
						} else {
							price = prices[coin + "USDT"];
						}
						if (coin === "BETH") price = prices["ETHUSDT"];
						if (coin === "USDT" || coin === "LDUSDT") price = 1;
						if (price === undefined) {
							price = prices[coin + "BTC"] * prices["BTCUSDT"];
						}
						if (price === undefined || isNaN(price)) {
							responseEmbed.addField(coin, `${balances[coin].available}`);
						} else {
							const toUSDT = Math.round(price * balances[coin].available * 100)/100;
							total += toUSDT;
							responseEmbed.addField(coin, `${balances[coin].available} ~= $${toUSDT}`);
						}
					}
					responseEmbed.addField("Total", `$${Math.round(total * 100) / 100}`);
					message.channel.send(responseEmbed);
				}
			});
		}
	}
});

const dailyLog = schedule.scheduleJob('40 19 17 * * *', async () => {
	for (user in users) {
		const binance = new Binance().options({
			APIKEY: users[user].apiKey,
			APISECRET: users[user].secret
		});

		await binance.balance(async (err, balances) => {
			if (err) {

			} else {
				//On trie la balance + enleve les 0
				balances = orderJson(balances);
				let prices = await binance.prices();
				let total = 0;
				for (coin in balances) {
					let price = undefined;
					if (coin.startsWith("LD")) {
						price = prices[coin.slice("LD".length) + "USDT"];
					} else {
						price = prices[coin + "USDT"];
					}
					if (coin === "BETH") price = prices["ETHUSDT"];
					if (coin === "USDT" || coin === "LDUSDT") price = 1;
					if (price === undefined) {
						price = prices[coin + "BTC"] * prices["BTCUSDT"];
					}
					if (price === undefined || isNaN(price)) {

					} else {
						const toUSDT = Math.round(price * balances[coin].available * 100)/100;
						total += toUSDT;
					}
				}
				if (users[user].history === undefined) users[user].history = {};
				users[user].history[(new Date()).toString()] = total;
				fs.writeFileSync("./users.json", JSON.stringify(users, null, 4));
			}
		});
	}
});

function orderJson(json){
	let max = -1;
	let coinToAdd;
	let valueToAdd;
	let coinTrie = {}
	let nbOfCoins = 0

	//On fait une première boucle pour savoir combien de coin y'aura dans le tableau à la fin
	for(coin in json){
		if(json[coin].available > 0){
			nbOfCoins+=1
		}
	}

	while(Object.keys(coinTrie).length != nbOfCoins){
		for(coin in json){
			if(json[coin].available > 0){
				if(Number(json[coin].available) > Number(max) && !isInJson(coin, coinTrie)){
					max = json[coin].available
					coinToAdd = coin
					valueToAdd = json[coin]
				}
			}
		}
		coinTrie[coinToAdd] = valueToAdd;
		max = -1
	}
	return coinTrie
}

function isInJson(coin, arrayOfCoin){
	for(coinName in arrayOfCoin){
		if(coinName == coin){
			return true
		}
	}
	return false
}

client.login('ODI5NjY5MDEwNzgyMDI3ODE3.YG7feg.RehG7HjSRc9vLJv6f5C0IMZzIPU');