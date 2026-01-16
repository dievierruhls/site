const profiles = [
    "0x73e24ba6a8506d592803048f70e821bc38c6c3a2",
    "0xf1ff528970690dd5f0f973d4f9cec352a0fd2c39"
];

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24h

async function fetchWithProxy(url) {
    const response = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`);
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    return response.json();
}

async function getProfileData(address) {
    const cacheKey = `profile_${address}`;
    const now = Date.now();

    const cachedItem = localStorage.getItem(cacheKey);
    if (cachedItem) {
        const parsed = JSON.parse(cachedItem);
        if (now - parsed.timestamp < CACHE_DURATION) {
            console.log(`Loading ${address} from cache`);
            return parsed.data;
        }
    }

    console.log(`Fetching ${address} from API`);
    try {
        const [profile, activeBets, pnl, closed] = await Promise.all([
            fetchWithProxy(`https://gamma-api.polymarket.com/public-profile?address=${address}`),
            fetchWithProxy(`https://data-api.polymarket.com/value?user=${address}`),
            fetchWithProxy(`https://data-api.polymarket.com/v1/leaderboard?category=OVERALL&timePeriod=ALL&orderBy=PNL&limit=25&user=${address}`),
            fetchWithProxy(`https://data-api.polymarket.com/v1/closed-positions?limit=10000000&sortBy=TIMESTAMP&sortDirection=DESC&user=${address}`)
        ]);

        const name = profile.name || "Unknown";
        const img = profile.profileImage || 'https://i.pinimg.com/736x/3c/13/98/3c139858ade16fe6bf2b3c8f7f2cd0fd.jpg';
        const value = activeBets[0]?.value ? `${parseFloat(activeBets[0].value).toFixed(2)}€` : "0,00€";
        const pnlValue = pnl[0]?.pnl ? pnl[0].pnl.toFixed(2) : "0.00";
        const posRatio = getPosRatio(closed);

        const data = { name, img, value, pnlValue, posRatio };

        localStorage.setItem(cacheKey, JSON.stringify({
            data: data,
            timestamp: now
        }));

        return data;
    } catch (error) {
        console.error(`Error loading data for ${address}:`, error);
        return null;
    }
}

function getPosRatio(closed) {
    let right = 0;

    for (const index in closed) {
        if (closed[index].realizedPnl > 0 && closed[index].curPrice === 1) {
            right += 1;
        }
    }

    return [closed.length, right];
}

async function renderProfiles() {
    const container = document.getElementById("container");
    if (!container) return;

    const profilePromises = profiles.map(address => getProfileData(address));
    const results = await Promise.all(profilePromises);

    let htmlContent = "";

    results.forEach(res => {
        if (!res) return;

        const { name, img, value, pnlValue, posRatio } = res;

        htmlContent += `
            <div class="duell-profile">
                <div class="duell-profile-pic">
                    <img src="${img}" alt="${name}">
                </div>
                <span class="duell-profile-name">${name}</span>
                <div class="duell-profile-value">
                    <span class="title">Aktive in Wetten</span>
                    <span class="value">${value}</span>
                </div>
                <div class="duell-profile-value">
                    <span class="title">Abgeschlossene Wetten</span>
                    <span class="value">${posRatio[0]}</span>
                </div>
                <div class="duell-profile-value">
                    <span class="title">Richtige Wetten</span>
                    <span class="value">${posRatio[1]}</span>
                </div>
                <div class="duell-profile-value">
                    <span class="title">Falsche Wetten</span>
                    <span class="value">${posRatio[0] - posRatio[1]}</span>
                </div>
                <div class="duell-profile-value">
                    <span class="title">Profit / Verlust</span>
                    <span class="value">${pnlValue}</span>
                </div>
            </div>`;
    });

    container.innerHTML = htmlContent;
}

renderProfiles();