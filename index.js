const figlet = require(`figlet`)
const fetch = require(`node-fetch`)
const fs = require(`fs`)
const readlineSync = require(`readline-sync`);
const cheerio = require(`cheerio`);
const moment = require(`moment`)
const colors = require(`colors`)
const axios = require('axios');

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

async function authen(accs) {
    auth = []
    console.log()
    await accs.forEach(async ac => {
        const json = {
            agent: { name: "Minecraft", version: 1 }, username: ac.email, password: ac.pass
        }
        const req = await axios.post("https://authserver.mojang.com/authenticate", json, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.89 Safari/537.36",
                "Content-Type": "application/json"
            }
        }).then(async au => {
            if (au.status != 200) {
                console.log(`Unavailable: ${ac.email}`.red);
                auth.push({ reauth: true, authTime: Date.now() })
            } else {
                options = {
                    headers: { "Authorization": `Bearer ${au.data.accessToken}` },
                }
                fetch('https://api.mojang.com/user/security/challenges', options).then(async ch => {
                    ques = await ch.json()
                    if (ques.length === 0) {
                        let inf = { email: ac.email, password: ac.pass, uuid: au.data.selectedProfile.id, token: au.data.accessToken, client: au.data.clientToken, reauth: false, authTime: Date.now() }
                        options = {
                            headers: { "Authorization": `Bearer ${au.data.accessToken}` },
                        }
                        fetch('https://api.minecraftservices.com/minecraft/profile/namechange', options).then(async nc => {
                            infoo = await nc.json()
                            infoo.nameChangeAllowed ? console.log(`Authenticated: ${ac.email}`.green) : console.log(`Unavailable: ${ac.email}`.red)
                            if (infoo.nameChangeAllowed) auth.push(inf)
                        })
                    } else {
                        console.log(`Unusable: ${ac.email}`.red);
                    }
                })
            }
        }).catch(async err => {
            console.log(`Unavailable: ${ac.email}`.red);
            auth.push({ reauth: true, authTime: Date.now() })
        })
    })
    return auth
}

async function getTime(name) {
    const $ = cheerio.load(await fetch(`https://namemc.com/search?q=${name}`).then(r => r.text()));

    if ($('.my-1').text().match(/Available/) == null) { console.log(); console.log(`${name} is already taken, can't snipe it`.red); process.exit(); }
    if ($('.my-1').text().match(/Available Later/) == null) { console.log(); console.log(`${name} is already available, can't snipe it`.red); process.exit(); }

    return moment(new Date(Object.values(Object.values($('.countdown-timer'))[0].attribs)[1]), "ddd MMM D h:mm:ss [GMT]ZZ [(GMT]Z[)]")
}

async function preSnipe(auths) {
    console.log()
    console.log(`Name available at ${moment(new Date(snipeTime.valueOf() - delay)).format(`HH[:]mm[:]ss[.]SSS`)}, sniping in ${((snipeTime.valueOf() - delay) - Date.now()) / 1000} seconds`.cyan)
    newAuths = []
    reauths > 0 ? console.log(`${reauths} accounts timed out, attempting to reauthenticate them...`.cyan) : ''
    await auths.forEach(async au => {
        if (au.reauth) {
            const json = {
                agent: { name: "Minecraft", version: 1 }, username: au.email, password: au.pass
            }
            const req = await axios.post("https://authserver.mojang.com/authenticate", json, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.89 Safari/537.36",
                    "Content-Type": "application/json"
                }
            }).then(async info => {
                if (info.status = 200) {
                    options = {
                        headers: { "Authorization": `Bearer ${au.data.accessToken}` },
                    }
                    fetch('https://api.mojang.com/user/security/challenges', options).then(async ch => {
                        ques = await ch.json()
                        if (ques.length === 0) {
                            let inf = { email: ac.email, password: ac.pass, uuid: au.data.selectedProfile.id, token: au.data.accessToken, client: au.data.clientToken, reauth: false, authTime: Date.now() }
                            options = {
                                headers: { "Authorization": `Bearer ${au.data.accessToken}` },
                            }
                            fetch('https://api.minecraftservices.com/minecraft/profile/namechange', options).then(async nc => {
                                infoo = await nc.json()
                                if (infoo.nameChangeAllowed) newAuths.push(inf)
                            })
                        }
                    })
                }
            }).catch(async err => { })
        } else {
            newAuths.push(au)
        }
    })
    await sleep(2000)
    if (newAuths.length === 0) { console.log(`None of your accounts are available to snipe at the moment`.red); console.log(`Try again in a few minutes`.red); process.exit() }
    console.log(`${newAuths.length} accounts will be attempting to snipe...`.cyan)
    await sleep(((snipeTime.valueOf() - delay) - Date.now()) - 15)
    console.log()
    for (let i = 0; i < 3; i++) snipe(newAuths)
}

async function snipe(au) {
    au.forEach(ac => {
        options = {
            method: `POST`,
            body: JSON.stringify({ name: ign, password: ac.password }),
            headers: { "Authorization": `Bearer ${ac.token}` },
        }
        let now = Date.now()
        fetch(`https://api.mojang.com/user/profile/${ac.uuid}/name`, options)
            .then(async resp => {
                info = await resp.json()
                if (resp.status === 200) {
                    console.log(`Name sniped! Email used: ${ac.email}`.green)
                } else {
                    console.log(resp)
                    process.exit()
                    resp.status != 429 ? console.log(`Failed snipe at ${moment(now).format(`HH[:]mm[:]ss[.]SSS`)}`.red) : process.exit()
                }
            })
    })
}

async function init() {
    console.log(figlet.textSync(`GameSniper`).blue)

    now = Date.now()
    const time = await fetch('https://worldtimeapi.org/api/ip')
    if (time.status === 200) {
        info = await time.json()
        atom = new Date(info.datetime)
        Math.abs((atom.valueOf() - now) < 30) ? console.log(`Your clock is out of sync by ${atom.valueOf() - now}ms`.cyan) : ''
        Math.abs((atom.valueOf() - now) < 30) ? console.log() : ''
    } else {
        console.log(`Time API is currently unavailable to calculate offset`.red)
        console.log()
    }

    global.accs = await setAccounts()
    if (accs.length > 20) { console.log(`More than 20 accounts was found, reducing to 20...`.cyan); console.log() }
    accs.length > 20 ? accs.length = 20 : ''

    global.ign = readlineSync.question(`What IGN would you like to snipe?\n> `);
    if (!ign.match(/\w{3,16}/g)) { console.log(`${ign} is not a valid username`.red); process.exit(); }

    global.snipeTime = await getTime(ign)

    global.delay = readlineSync.question(`What delay would you like to have in ms?\n> `);
    if (!parseInt(delay) || parseInt(delay) < 0) { console.log(`Couldn't read that delay`.red); process.exit() }

    await authen(accs).then(async auths => {
        await sleep(2000)
        console.log()
        console.log(`Sniping ${ign} in ~${Math.round(((snipeTime.valueOf() - delay) - Date.now()) / 1000)} seconds`.cyan)
        global.reauths = 0
        auths.forEach(au => {
            if ((snipeTime.valueOf() - au.authTime) > 50000) { au.reauth = true; reauths++ }
        })
        if (snipeTime.valueOf() - Date.now() < 30000) {
            preSnipe(auths)
        } else {
            await sleep(snipeTime.valueOf() - Date.now() - 30000)
            preSnipe(auths)
        }
    })
}
init()