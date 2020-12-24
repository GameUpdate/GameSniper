const figlet = require(`figlet`)
const fetch = require(`node-fetch`)
const ms = require(`ms`)
const fs = require(`fs`)
const readlineSync = require(`readline-sync`);
const https = require(`https`);
const cheerio = require(`cheerio`);
const moment = require(`moment`)

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function setAccounts() {
    const data = fs.readFileSync('accounts.txt', 'UTF-8');
    const lines = data.split(/\r?\n/);

    ac = []
    lines.forEach((line) => {
        if (line.length > 1) {
            ac.push({
                email: line.split(':')[0],
                pass: line.split(':')[1]
            })
        }
    })
    return ac
}

async function auth(accs) {
    auth = []
    const httpsAgent = new https.Agent({ name: "Minecraft", version: 1 });
    console.log()
    await accs.forEach(async ac => {
        options = {
            method: `POST`,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: ac.email, password: ac.pass }),
            agent: httpsAgent
        }

        fetch('https://authserver.mojang.com/authenticate', options).then(async au => {
            if (au.status != 200) {
                console.log(`Could not log into: ${ac.email}`);
            } else {
                info = await au.json()
                inf = { token: info.accessToken, client: info.clientToken, date: Date.now(), reauth: false }
                if (val(inf)) {
                    options = {
                        headers: { "Authorization": `Bearer ${info.accessToken}` },
                    }
                    fetch('https://api.minecraftservices.com/minecraft/profile/namechange', options).then(async nc => {
                        infoo = await nc.json()
                        infoo.nameChangeAllowed ? console.log(`Succesfully authenticated ${ac.email}`) : console.log(`${ac.email} cannot change name`)
                        if (infoo.nameChangeAllowed) auth.push(inf)
                    })
                } else {
                    console.log(`Could not authenticate: ${ac.email}`);
                }
            }
        })
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

    if ($('.my-1').text().match(/Available/) == null) { console.log(); console.log(`${name} is already taken, can't snipe it`); process.exit(); }
    if ($('.my-1').text().match(/Available Later/) == null) { console.log(); console.log(`${name} is already available, can't snipe it`); process.exit(); }

    return moment(new Date(Object.values(Object.values($('.countdown-timer'))[0].attribs)[1]), "ddd MMM D h:mm:ss [GMT]ZZ [(GMT]Z[)]")
}

async function preSnipe(auths) {
    console.log(`Sniping in 30s....`)
    const re = auths.filter(a => a.reauth)
    if(re.length > 0) await auth(accs)
    await sleep(snipeTime.valueOf() - Date.now() - delay - 10)
    console.log(`Attempting to snipe`)
    console.log(auths.length)
    for (let i = 0; i < 10; i++) { for (let j = 0; j < auths.length; j++) snipe(auths[j]) }
}

async function snipe(au) {
    options = {
        method: `POST`,
        headers: { "Authorization": `Bearer ${au.token}` },
    }
    console.log(`sniping`)
    fetch(`https://api.minecraftservices.com/minecraft/profile/name/${ign}`, options)
        .then(function (response) {
            logger.info("Name sniped.")
            console.log(response.data);
            process.exit();
        }).catch(function (error) {
            logger.warn("Snipe failed! at " + (snipeTime - Date.now()) + "ms");
            console.log(error.response.data);
        });
}

async function init() {

    console.log(figlet.textSync(`GameSniper`))
    const time = await fetch('https://worldtimeapi.org/api/ip')
    //if (time.status != 200) return console.log(`Time API Unavailable, time offset unknown`)
    //console.log(`You have a time offset of: ${Date.now() - Date(time.data.datetime)}ms`)

    global.accs = await setAccounts()
    accs.length > 20 ? accs.length = 20 : ''

    global.ign = readlineSync.question(`What IGN would you like to snipe?\n> `);
    if (!ign.match(/\w{3,16}/g)) { console.log(`${ign} is not a valid username`); process.exit(); }

    global.snipeTime = await getTime(ign)

    global.delay = readlineSync.question(`What delay would you like to have in ms?\n> `);
    if (!parseInt(delay) || parseInt(delay) < 0) { console.log(`Couldn't read that delay`); process.exit() }

    auth(accs).then(async auths => {
        await auths.forEach(au => {
            au.reauth = ((snipeTime.valueOf() - au.date) > 50000) ? true : false
        })

        await sleep(1000)
        console.log();
        console.log(`Sniping ${ign} in ${moment().to(snipeTime, true)}`)
        console.log(`Currently have ${auths.length} available accounts to snipe with`)
        if (snipeTime.valueOf() - Date.now() < 30000) {
            preSnipe(auths)
        } else {
            await sleep(snipeTime.valueOf() - Date.now() - 30000)
            preSnipe(auths)
        }
    })
}
init()