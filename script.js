/**
 * 终末地武库配额推算引擎 v15.1
 * 逻辑更新：常驻池产出变为版本固定（16抽），周常任务产出随天数动态变化（100/周）。
 */

const currentQuotaInput = document.getElementById('currentQuota');
const pityCountInput = document.getElementById('pityCount');
const pullsInput = document.getElementById('pulls');
const daysInput = document.getElementById('days');
const refreshesInput = document.getElementById('refreshes');
const refreshVal = document.getElementById('refreshVal');
const algoMode = document.getElementById('algoMode');
const battlePassCheck = document.getElementById('battlePass');
const autoVersionRewardsCheck = document.getElementById('autoVersionRewards'); 
const versionTip = document.getElementById('versionTip'); 

const totalResult = document.getElementById('totalResult');
const weaponEquiv = document.getElementById('weaponEquiv');
const progressEl = document.getElementById('progress');
const tierTip = document.getElementById('tierTip');

/** 限定池逻辑 */
function getWorstCaseQuotaWithPity(p, pity) {
    p = Math.floor(p);
    pity = Math.floor(pity);
    if (p <= 0) return 0;

    let totalQuota = 0;
    let pity80 = pity;          
    let pity10 = pity % 10;     
    let sixStarBefore120 = 0;   

    for (let i = 1; i <= p; i++) {
        pity80++;
        pity10++;
        let is6Star = false;

        if (i === 120) {
            is6Star = true;
        } else if (i === 119 && sixStarBefore120 < 2 && pity >= 30) {
            is6Star = true;
        } else if (pity80 === 80) {
            is6Star = true;
        }

        if (is6Star) {
            totalQuota += 2000;
            if (i < 120) sixStarBefore120++;
            pity80 = 0; 
            pity10 = 0; 
        } else if (pity10 === 10) {
            totalQuota += 200;
            pity10 = 0;
        } else {
            totalQuota += 20;
        }
    }
    return totalQuota;
}

/** 常驻池独立逻辑 (无120抽限定保底) */
function getStandardBannerWorstCase(p) {
    let totalQuota = 0;
    let p80 = 0;
    let p10 = 0;
    
    for(let i = 1; i <= p; i++) {
        p80++; 
        p10++;
        if(p80 === 80) { 
            totalQuota += 2000; 
            p80 = 0; 
            p10 = 0; 
        } else if (p10 === 10) { 
            totalQuota += 200; 
            p10 = 0; 
        } else { 
            totalQuota += 20; 
        }
    }
    return totalQuota;
}

function getTieredChance(n) {
    const p = Math.floor(n); 
    const tiers = [
        { min: 80, val: 100.00 }, { min: 70, val: 59.07 }, { min: 60, val: 53.35 },
        { min: 50, val: 46.87 }, { min: 40, val: 39.55 }, { min: 30, val: 26.03 },
        { min: 20, val: 18.21 }, { min: 10, val: 9.56 }
    ];
    for (let t of tiers) if (p >= t.min) return t.val;
    return 0.00;
}

function updateCalculator() {
    const currentQuota = parseFloat(currentQuotaInput.value) || 0;
    const pityPulls = Math.min(parseFloat(pityCountInput.value) || 0, 79);
    const rolePulls = parseFloat(pullsInput.value) || 0; 
    const days = parseFloat(daysInput.value) || 0;
    const manualRefreshes = parseInt(refreshesInput.value) || 0;
    const mode = algoMode.value;
    const hasBP = battlePassCheck.checked;
    const enableVersion = autoVersionRewardsCheck.checked;

    if(refreshVal) refreshVal.textContent = manualRefreshes;

    // 1. 角色限定池收益
    let gachaYield = (mode === 'expected') ? (rolePulls * 74.18) : getWorstCaseQuotaWithPity(rolePulls, pityPulls);
    let bonusQuota = (rolePulls >= 30) ? ((mode === 'expected') ? 741.8 : 380) : 0;

    // 2. 商店与月卡
    const storeYield = days * (manualRefreshes + 1) * 4.614;
    const bpYield = hasBP ? 2400 : 0;

    // 3. 常驻福利与动态周常
    let weeklyYield = 0;
    let standardYield = 0;

    if (enableVersion) {
        // 周常：受囤积天数影响，向下取整算完整周
        const weeks = Math.floor(days / 7);
        weeklyYield = weeks * 100;

        // 常驻池：固定计入1版本（16抽），不再随天数按比例放大或缩小
        const standardPulls = 16;
        standardYield = (mode === 'expected') 
            ? (standardPulls * 74.18) 
            : getStandardBannerWorstCase(standardPulls);

        if (versionTip) {
            versionTip.innerText = `周常计算+${weeklyYield} | 常驻产出+${Math.round(standardYield)}`;
            versionTip.className = "text-[10px] text-sky-400 font-mono font-bold truncate transition-colors";
        }
    } else {
        if (versionTip) {
            versionTip.innerText = "未开启";
            versionTip.className = "text-[10px] text-slate-500 font-mono truncate transition-colors";
        }
    }

    // 4. 汇总换算
    const finalTotal = currentQuota + gachaYield + bonusQuota + storeYield + bpYield + weeklyYield + standardYield;
    const WEAPON_COST = 198;
    const weaponWaterLevel = finalTotal / WEAPON_COST;

    // 5. UI 更新
    totalResult.innerText = Math.round(finalTotal).toLocaleString();
    weaponEquiv.innerText = weaponWaterLevel.toFixed(2) + " 抽"; 

    const currentChance = getTieredChance(weaponWaterLevel);
    progressEl.innerText = currentChance.toFixed(2) + "%";
    
    if (currentChance >= 100) progressEl.className = "text-emerald-400 font-mono text-sm font-bold";
    else if (currentChance >= 39) progressEl.className = "text-sky-400 font-mono text-sm font-bold";
    else progressEl.className = "text-slate-500 font-mono text-sm font-bold";

    if (tierTip) {
        if (weaponWaterLevel < 80) {
            const nextTier = (Math.floor(weaponWaterLevel / 10) + 1) * 10;
            const quotaNeeded = Math.ceil((nextTier - weaponWaterLevel) * WEAPON_COST);
            tierTip.innerText = `距 ${nextTier} 抽概率跃迁还差约 ${quotaNeeded} 配额`;
        } else {
            tierTip.innerText = "已进入 80 抽定向保底覆盖范围";
        }
    }
}

// 事件监听
[currentQuotaInput, pityCountInput, pullsInput, daysInput, refreshesInput, algoMode, battlePassCheck, autoVersionRewardsCheck].forEach(el => {
    if(el) {
        const ev = el.type === 'checkbox' ? 'change' : 'input';
        el.addEventListener(ev, updateCalculator);
    }
});

updateCalculator();