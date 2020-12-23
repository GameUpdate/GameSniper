const figlet = require(`figlet`)
const fetch = require(`node-fetch`)
const ms = require(`ms`)
const fs = require(`fs`)
const readlineSync = require(`readline-sync`);
const https = require(`https`);
const cheerio = require(`cheerio`);
const moment = require(`moment`)

function sleep(milliseconds) {
    const date = Date.now();
    let currentDate = null;
    do {
        currentDate = Date.now();
    } while (currentDate - date < milliseconds);
}

async function setAccounts() {
    const data = fs.readFileSync('accounts.txt', 'UTF-8');
    const lines = data.split(/\r?\n/);

    ac = []
    await lines.forEach((line) => {
        if (line.length > 1) {
            ac.push({
                email: line.split(':')[0],
                pass: line.split(':')[1]
            })
        }
    });
    return ac
}

async function auth(accs) {
    auth = []
    const httpsAgent = new https.Agent({ name: "Minecraft", version: 1 });
    console.log()
    console.log(`+――――――――――――――――――――――――――――――――――――――――+`)
    await accs.forEach(async ac => {
        options = {
            method: `POST`,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: ac.email, password: ac.pass }),
            agent: httpsAgent
        }

        let au = await fetch('https://authserver.mojang.com/authenticate', options)
        if (au.status != 200) {
            console.log(`Could not log into: ${ac.email}`);
        } else {
            info = await au.json()
            inf = { token: info.accessToken, client: info.clientToken, date: Date.now(), reauth: false }
            val(inf) ? console.log(`Succesfully authenticated ${ac.email}`) : console.log(`Could not authenticate: ${ac.email}`);
        }
    })
    return auth
}

async function val(info) {
    options = {
        method: `POST`,
        body: JSON.stringify({ accessToken: info.token }),
    }
    const req = await fetch("https://authserver.mojang.com/validate", options);
    if (req.status != 204) return false
    return true
}

async function getTime(name) {
    const $ = cheerio.load(await fetch(`https://namemc.com/search?q=${name}`).then(r => r.text()));

    if ($('.my-1').text().match(/Available/) == null) return console.log(`${name} is already taken, can't snipe it`);
    if ($('.my-1').text().match(/Available Later/) == null) return console.log(`${name} is already available, can't snipe it`);

    return moment(new Date(Object.values(Object.values($('.countdown-timer'))[0].attribs)[1]), "ddd MMM D h:mm:ss [GMT]ZZ [(GMT]Z[)]")
}

async function preSnipe(auths) {
    console.log(`Sniping in 30s....`)
    auths.forEach(async auth => {
        if (auth.reauth) {
            auth = await auth([auth])
        }
        setTimeout(async function () {
            console.log(`Attempting to snipe`)
            for (let i = 0; i < 10; i++) snipe(auth);
        }, (snipeTime.valueOf() - Date.now() - max - 10));
    })
}

async function snipe(auth) {
    options = {
        method: `POST`,
        headers: { "Authorization": auth.token },
    }
    fetch(`https://api.mojang.com/user/profile/${uuid}/name`, options)
        .then(function (response) {
            logger.info("Name sniped.")
            console.log(response.data);
            process.exit();
        }).catch(function (error) {
            logger.warn("Snipe failed! at " + (snipeTime - Date.now) + "ms");
            console.log(error.response.data);
        });
}

async function init() {

    console.log(figlet.textSync(`GameSniper`))
    const time = await fetch('https://worldtimeapi.org/api/ip')
    //if (time.status != 200) return console.log(`Time API Unavailable, time offset unknown`)
    //console.log(`You have a time offset of: ${Date.now() - Date(time.data.datetime)}ms`)

    var accs = await setAccounts(accs)
    accs.length > 30 ? accs.length = 30 : ''
    const ign = await readlineSync.question(`What IGN would you like to snipe?\n> `);
    if (!ign.match(/\w{3,16}/g)) return console.log(`${ign} is not a valid username`);

    const delay = await readlineSync.question(`What delay would you like to have in ms?\n> `);
    if (!parseInt(delay) || parseInt(delay) < 0) return console.log(`Couldn't read that delay`)

    var auths = await auth(accs)
    const snipeTime = await getTime(ign)
    await snipeTime ? console.log(`Sniping ${ign} in ${moment().to(snipeTime, true)}`) : null

    await auths.forEach(au => {
        au.reauth = ((snipeTime.valueOf() - au.date) > 50000) ? true : false
    })

    return console.log(auths)
}
init()