const fs = require("fs");
const Discord = require('discord.js');
const Binance = require('node-binance-api');
const client = new Discord.Client();
const users = require('./users.json');
const schedule = require('node-schedule');
require('dotenv').config();

const prefix = "!";


client.on('ready', () => {
	console.log(`Logged in as ${client.user.tag}!`);
});

client.on('message', async message => {
	if (!message.content.startsWith(prefix) || message.author.bot) return;

	const args = message.content.slice(prefix.length).trim().split(' ');
	const command = args.shift().toLowerCase();


	if (command === "register") {
		//Tutorial register
		if(args.length != 2) {
			const embed = new Discord.MessageEmbed()
			.setFooter(" - ",message.author.avatarURL())
			.setTimestamp()
			.setColor("#F8D12F")
			.setTitle("Register Tutorial")
			.addField("Step 1", "Connect to your binance account")
			.addField("Step 2", 'Go to [API Managment](https://www.binance.com/en/my/settings/api-management) tab')
			.addField("Step 3", "Create API (you can put any name you want)")
			.addField("Step 4", "You will have two keys, one API and one Secret.\n Go back to Discord channel and type !register `API` `Secret`, replacing API and Secret with your keys.\n  **!! Care you can see your secret key only once !!**")
			.addField("Step 5", "Type !help to get the list of commands. Enjoy !")
			message.channel.send(embed)
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
					else{
						message.channel.send("Vous êtes maintenant inscrit!");	
						message.delete();
					}
				});
			}
		});
	} else if(command == "help"){
		const embed = new Discord.MessageEmbed()
		.setFooter(" - ",message.author.avatarURL())
		.setTimestamp()
		.setColor("#F8D12F")
		.setTitle("Need help "+message.member.displayName+" ?")
		.addField("!register", "Displays the tutorial to register to the bot")
		.addField("!logout", "Unregister from the bot, deleting all your information from it")
		.addField("!balance", "Retrieve your balance information and displays it")
		.addField("!balance @someone", "Retrieve @someone's balance (if it has registered)")
		.addField("!futures", "Retriveve your futures information and displays it")
		message.channel.send(embed)
	}
	else if (command === "logout") {
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
		if (command === "balance") {
			if(args[0] && args[0].startsWith("<@")){
				let id;
				if (args[0].includes("!")) id = args[0].slice("<@!".length, args[0].length-1);
				else id = args[0].slice("<@".length, args[0].length-1);
				console.log(id)
				const binance = new Binance().options({
					APIKEY: users[id].apiKey,
					APISECRET: users[id].secret
				});
				getBalance(binance, message, client.users.cache.get(id).username)
			}
			else{
				const binance = new Binance().options({
					APIKEY: users[message.author.id].apiKey,
					APISECRET: users[message.author.id].secret
				});
				getBalance(binance, message, message.member.displayName)
			}
		}
		else if (command === "futures") {
			if(args[0] && args[0].startsWith("<@")){
				let id;
				if (args[0].includes("!")) id = args[0].slice("<@!".length, args[0].length-1);
				else id = args[0].slice("<@".length, args[0].length-1);
				try{
					const binance = new Binance().options({
						APIKEY: users[id].apiKey,
						APISECRET: users[id].secret
					});
					getFutureBalance(binance, message, client.users.cache.get(id).username)
				} catch(err){
					console.error(err);
				}
			}
			else{
				try {
					const binance = new Binance().options({
						APIKEY: users[message.author.id].apiKey,
						APISECRET: users[message.author.id].secret
					});
					getFutureBalance(binance, message, message.member.displayName)
				} catch (err) {
					console.error(err);
				}
			}
		}
	}
});

async function getFutureBalance(binance, message, username){
	const futures = await binance.futuresAccount();
	const positions = futures.positions;
	const responseEmbed = new Discord.MessageEmbed()
		.setTitle(`${username}'s futures balance`)
	for (future in positions) {
		if (positions[future].initialMargin > 0) {
			responseEmbed.addField(`${positions[future].symbol} (x${positions[future].leverage})`, (positions[future].unrealizedProfit>0?"```diff\n+":"```diff\n") + positions[future].unrealizedProfit + '\n```');
		}
	}
	message.channel.send(responseEmbed);
}

function getBalance(binance, message, username){
	binance.balance(async (err, balances) => {
		if (err) {
			message.channel.send("Une erreur est survenue, peut-être que vos clés sont invalides.");
		} else {
			//On trie la balance + enleve les 0
			balances = orderJson(balances);
			let prices = await binance.prices();
			let total = 0;
			const responseEmbed = new Discord.MessageEmbed()
				.setTitle(`${username}'s balance`)
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
					balances[coin]["usdt"] = ""
					// responseEmbed.addField(coin, `${balances[coin].available}`);
				} else {
					const toUSDT = Math.round(price * balances[coin].available * 100)/100;
					balances[coin]["usdt"] = toUSDT
					total += toUSDT;
					// responseEmbed.addField(coin, `${balances[coin].available} ~= $${toUSDT}`);
				}
				balances[coin]["name"] = coin
			}
			balances = orderJson(balances, "usdt");
			balances["total"] = total
			for(coin in balances){
				if(balances[coin]["name"] != undefined && balances[coin].usdt > 1){
					responseEmbed.addField(balances[coin]["name"], `${balances[coin].available} ~= $${balances[coin].usdt}`)
				}
			}
			responseEmbed.addField("Total", `$${Math.round(total * 100) / 100}`);
			message.channel.send(responseEmbed);
		}
	});
}



const dailyLog = schedule.scheduleJob('* 00 23 * * *', async () => {
	for (user in users) {
		const binance = new Binance().options({
			APIKEY: users[user].apiKey,
			APISECRET: users[user].secret
		});
		callBalanceAndSaveToJSON(binance, user)
	}
});

async function callBalanceAndSaveToJSON(binance, user){
	let prices = await binance.prices();
	console.log("after prices")

	await binance.balance((err, balances) => {
		console.log("balance")
		if (err) {
			console.log("error")
		} else {
			//On trie la balance + enleve les 0
			balances = orderJson(balances);
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
			console.log("user before changing history and modify json : "+user)
			if (users[user].history === undefined) users[user].history = {};
			users[user].history[(new Date()).toString()] = total;
			console.log("finish modify users")
			fs.writeFile("./users.json", JSON.stringify(users, null, 4), (err) => {
				if (err) console.error(err);
				else console.log("Updated file");
			});
		}
	});
}

function orderJson(json, mode="available"){
    let max = -1;
    let coinToAdd;
    let valueToAdd;
    let coinTrie = {}
    let nbOfCoins = 0

    if(mode == "available"){
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
    else{
        //On fait une première boucle pour savoir combien de coin y'aura dans le tableau à la fin
        for(coin in json){
            if(json[coin].available > 0){
                nbOfCoins+=1
            }
        }
    
        while(Object.keys(coinTrie).length != nbOfCoins){
            for(coin in json){
				if(Number(json[coin].usdt) > Number(max) && !isInJson(coin, coinTrie)){
					max = json[coin].usdt
					coinToAdd = coin
					valueToAdd = json[coin]
				}
            }
            coinTrie[coinToAdd] = valueToAdd;
            max = -1
        }
        return coinTrie
    }
}

function isInJson(coin, arrayOfCoin){
	for(coinName in arrayOfCoin){
		if(coinName == coin){
			return true
		}
	}
	return false
}

client.login(process.env.DISCORD_TOKEN);

