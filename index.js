const fs = require('fs');
const turbo = require('turbo-http')
const port = +process.argv[2] || 3000

const cardsData = fs.readFileSync('./cards.json');
const allCards = JSON.parse(cardsData).map(card => {
    const str = `{ "id": "${card.id}", "name": "${card.name}"}`;
    return {
        card: str,
        length: str.length
    };
});

const finalCard = { card: '{ "id": "ALL CARDS" }', length: 21};
const readyCard = { card: '{ "ready": "true" }', length: 19 };

let serverId = 0;
let numOfServers = 0;

let cards = [];
let half = 0;
let lowIndex = 0;
let highIndex = 50;

function prepareIndexes() {
    half = allCards.length / numOfServers;
    lowIndex = Math.floor((serverId - 1) * half)
    highIndex = Math.floor(serverId * half)
    cards = allCards.slice(lowIndex, highIndex)
    cards.unshift(finalCard)
}

const users = {};

async function requestHandler (req, res) {
    switch (req.url[1]) { //slightly faster than charAt(1)
        case 'c': // /card_add
            if (undefined === users[req.url]) {
                users[req.url] = 0;
            }
            const userCardCount = ++users[req.url]
            if (userCardCount > half) {
                res.setHeader('Content-Length', finalCard.length);
                res.write(finalCard.card);
                return;
            }

            const card = cards[userCardCount];
            res.setHeader('Content-Length', card.length);
            res.write(card.card);
            return;

        default: // /ready
            res.setHeader('Content-Length', readyCard.length);
            res.write(readyCard.card);
    }
}

const client = require('redis').createClient();
client.on('error', (err) => console.log('Redis Client Error', err));

async function prepareServers () {
    return new Promise((resolve, reject) => {
        let timesCheck = 0;
        const intervalId = setInterval(async () => {
            const result = await client.get('num-of-servers');
            if (numOfServers === result) {
                timesCheck++;
                if (5 === timesCheck) {
                    clearInterval(intervalId);
                    resolve();
                }
            } else {
                numOfServers = result;
            }
        }, 1000)
    });
}

client.on('ready', async () => {
    try {
        serverId = await client.incr('num-of-servers');
        numOfServers = serverId;
        await prepareServers();
        prepareIndexes();

        const server = turbo.createServer(requestHandler)
        server.listen(port)
        console.log(`Server is running on http://0.0.0.0:${port}`);
    } catch (error) {
        console.error(error)
    }
})

client.connect();
