import { Router } from 'express';
import express from 'express';
import { GameData } from '@server/timelines/game-data';
import { SettingsManager } from '@server/settings';
import { PenguinRepository } from '@server/database/database';
import { WorldServer } from '@server/socket-server/world-server';
import { verifyPenguinPassword } from '@server/auth/password';
import {
  BETA_CUTOFF_DATE,
  evaluateMembership,
  getMembershipPacks,
  getMembershipPack,
  MembershipPack,
  PRICE_INCREASE_DATE
} from '@server/auth/membership';
import { isLower } from '@server/routes/versions';

export function createMembershipRouter(
  gameData: GameData,
  settings: SettingsManager,
  db: PenguinRepository,
  worldServer?: WorldServer
): Router {
  const router = Router();

  router.use(express.urlencoded({ extended: true }));
  router.use(express.json());

  // Status check endpoint
  router.get('/api/membership/status', (_req, res) => {
    const currentDate = gameData.getDate();
    const betaDisabled = isLower(currentDate, BETA_CUTOFF_DATE);
    const packs = getMembershipPacks(currentDate);
    res.json({
      timelineDate: currentDate,
      betaDisabled,
      isPriceIncrease: !isLower(currentDate, PRICE_INCREASE_DATE),
      packages: packs
    });
  });

  // Login endpoint
  router.post('/api/membership/login', async (req, res) => {
    const { username, password } = req.body ?? {};
    if (!username || typeof username !== 'string') {
      res.status(400).json({ error: 'Username is required.' });
      return;
    }

    const pair = await db.fromName(username.trim());
    if (!pair) {
      res.status(401).json({ error: 'Penguin not found. Check your username.' });
      return;
    }

    const [id, penguinJson] = pair;
    const valid = await verifyPenguinPassword(password ?? '', penguinJson);
    if (!valid) {
      res.status(401).json({ error: 'Incorrect password.' });
      return;
    }

    // Check if player is currently online in the world
    const online = worldServer?.world.getById(id);
    const coins = online ? online.currency.coins : penguinJson.coins;
    const membershipExpires = online ? online.membership.membershipExpires : penguinJson.membership_expires;

    const evalResult = evaluateMembership(
      { ...penguinJson, membership_expires: membershipExpires },
      gameData.getDate(),
      Date.now(),
      settings.settings.always_member
    );

    const currentDate = gameData.getDate();
    const betaDisabled = isLower(currentDate, BETA_CUTOFF_DATE);
    const packs = getMembershipPacks(currentDate);

    res.json({
      success: true,
      penguin: {
        id,
        name: penguinJson.name,
        coins,
        isMember: evalResult.isMember,
        expiryDateString: evalResult.expiryDateString,
        membershipExpires: membershipExpires ?? null,
      },
      timelineDate: currentDate,
      betaDisabled,
      packages: packs
    });
  });

  // Purchase endpoint
  router.post('/api/membership/buy', async (req, res) => {
    const currentDate = gameData.getDate();
    if (isLower(currentDate, BETA_CUTOFF_DATE)) {
      res.status(403).json({ error: 'Membership is not available prior to October 24, 2005.' });
      return;
    }

    const { username, password, packageId } = req.body ?? {};
    if (!username || typeof username !== 'string') {
      res.status(400).json({ error: 'Username is required.' });
      return;
    }

    if (!packageId || typeof packageId !== 'string') {
      res.status(400).json({ error: 'Please select a membership package.' });
      return;
    }

    const pack = getMembershipPack(packageId, currentDate);
    if (!pack) {
      res.status(400).json({ error: 'Invalid membership package selected.' });
      return;
    }

    const pair = await db.fromName(username.trim());
    if (!pair) {
      res.status(401).json({ error: 'Penguin not found.' });
      return;
    }

    const [id, penguinJson] = pair;
    const valid = await verifyPenguinPassword(password ?? '', penguinJson);
    if (!valid) {
      res.status(401).json({ error: 'Incorrect password.' });
      return;
    }

    const online = worldServer?.world.getById(id);
    const currentCoins = online ? online.currency.coins : penguinJson.coins;

    if (currentCoins < pack.coins) {
      res.status(400).json({
        error: `Insufficient coins. You have ${currentCoins.toLocaleString()} coins, but the ${pack.name} package costs ${pack.coins.toLocaleString()} coins.`
      });
      return;
    }

    const now = Date.now();
    const currentExpiry = online
      ? online.membership.membershipExpires
      : penguinJson.membership_expires;

    const baseTime = (currentExpiry !== null && currentExpiry !== undefined && currentExpiry > now)
      ? currentExpiry
      : now;
    const newExpiry = baseTime + pack.durationMs;

    let remainingCoins: number;

    if (online) {
      online.currency.discount(pack.coins);
      online.membership.setMembershipExpires(newExpiry);
      worldServer?.persister(online, true);
      remainingCoins = online.currency.coins;

      try {
        worldServer?.msg.send(online, 'ai', -1, online.currency.coins);
      } catch {}
    } else {
      penguinJson.coins -= pack.coins;
      penguinJson.membership_expires = newExpiry;
      await db.update(id, penguinJson);
      remainingCoins = penguinJson.coins;
    }

    const expDate = new Date(newExpiry).toISOString().split('T')[0];

    res.json({
      success: true,
      packageId: pack.id,
      packageName: pack.name,
      cadPrice: pack.cadPrice,
      coinsSpent: pack.coins,
      daysAdded: pack.days,
      newExpiry: expDate,
      remainingCoins
    });
  });

  // Serve the HTML webpage
  const renderWebpage = (_req: express.Request, res: express.Response) => {
    const currentDate = gameData.getDate();
    const betaDisabled = isLower(currentDate, BETA_CUTOFF_DATE);
    const packs = getMembershipPacks(currentDate);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(generateHtmlPage(currentDate, betaDisabled, packs));
  };

  router.get('/membership', renderWebpage);
  router.get('/membership/', renderWebpage);
  router.get('/membership.html', renderWebpage);
  router.get('/buy', renderWebpage);
  router.get('/buy/', renderWebpage);
  router.get('/member', renderWebpage);
  router.get('/member/', renderWebpage);

  return router;
}

function generateHtmlPage(timelineDate: string, betaDisabled: boolean, packs: MembershipPack[]): string {
  const isPostIncrease = !isLower(timelineDate, PRICE_INCREASE_DATE);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Club Penguin — Membership Portal</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: linear-gradient(180deg, #005a9c 0%, #003366 100%);
      color: #333333;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 30px 15px;
    }
    .header-banner {
      text-align: center;
      margin-bottom: 25px;
    }
    .header-banner h1 {
      font-size: 32px;
      color: #ffffff;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.4);
      margin-bottom: 6px;
      letter-spacing: 0.5px;
    }
    .header-banner p {
      color: #b8e2ff;
      font-size: 15px;
    }
    .timeline-badge {
      display: inline-block;
      margin-top: 8px;
      padding: 4px 14px;
      background: rgba(255, 255, 255, 0.15);
      border-radius: 20px;
      color: #ffffff;
      font-size: 13px;
      font-weight: 600;
      border: 1px solid rgba(255, 255, 255, 0.25);
    }
    .card {
      background: #ffffff;
      width: 100%;
      max-width: 580px;
      border-radius: 16px;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.35);
      padding: 30px;
      position: relative;
    }
    .beta-warning {
      background: #fff3cd;
      border: 1px solid #ffeeba;
      color: #856404;
      padding: 14px 18px;
      border-radius: 10px;
      margin-bottom: 20px;
      font-size: 14px;
      line-height: 1.5;
    }
    .beta-warning strong {
      display: block;
      margin-bottom: 4px;
      color: #6c5200;
    }
    .price-notice {
      background: #e0f2fe;
      border: 1px solid #bae6fd;
      color: #0369a1;
      padding: 10px 14px;
      border-radius: 8px;
      margin-bottom: 18px;
      font-size: 13px;
      line-height: 1.4;
    }
    .form-group {
      margin-bottom: 18px;
    }
    .form-group label {
      display: block;
      font-weight: 600;
      font-size: 14px;
      margin-bottom: 6px;
      color: #444;
    }
    .form-group input {
      width: 100%;
      padding: 12px 14px;
      font-size: 15px;
      border: 2px solid #d2dbe5;
      border-radius: 8px;
      outline: none;
      transition: border-color 0.2s;
    }
    .form-group input:focus {
      border-color: #0084ff;
    }
    .btn {
      width: 100%;
      padding: 14px;
      font-size: 16px;
      font-weight: 700;
      color: #ffffff;
      background: linear-gradient(180deg, #ffb800 0%, #e08b00 100%);
      border: none;
      border-radius: 8px;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(224, 139, 0, 0.4);
      transition: transform 0.1s, opacity 0.2s;
    }
    .btn:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(224, 139, 0, 0.5);
    }
    .btn:active:not(:disabled) {
      transform: translateY(1px);
    }
    .btn:disabled {
      background: #cccccc;
      box-shadow: none;
      cursor: not-allowed;
      opacity: 0.7;
    }
    .btn-secondary {
      background: #f0f3f6;
      color: #555;
      font-weight: 600;
      box-shadow: none;
      margin-top: 10px;
      padding: 10px;
      font-size: 14px;
    }
    .btn-secondary:hover {
      background: #e2e7ec;
    }
    .alert {
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      margin-bottom: 18px;
      display: none;
    }
    .alert-error {
      background: #fde8e8;
      border: 1px solid #f8b4b4;
      color: #9b1c1c;
    }
    .alert-success {
      background: #def7ec;
      border: 1px solid #bcf0da;
      color: #03543f;
    }
    /* Profile Section */
    .profile-box {
      background: #f4f8fc;
      border: 1px solid #d9e6f2;
      border-radius: 12px;
      padding: 18px;
      margin-bottom: 22px;
    }
    .profile-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
      font-size: 15px;
    }
    .profile-row:last-child {
      margin-bottom: 0;
    }
    .profile-name {
      font-size: 18px;
      font-weight: 700;
      color: #003366;
    }
    .coins-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: #fff8e1;
      border: 1px solid #ffe082;
      padding: 4px 10px;
      border-radius: 20px;
      font-weight: 700;
      color: #b78103;
    }
    .status-badge {
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 700;
    }
    .status-member {
      background: #e1f5fe;
      color: #0277bd;
    }
    .status-nonmember {
      background: #f5f5f5;
      color: #757575;
    }
    /* Package cards */
    .packages-title {
      font-size: 15px;
      font-weight: 700;
      color: #2d3748;
      margin-bottom: 12px;
    }
    .packages-container {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 20px;
    }
    .package-card {
      background: #ffffff;
      border: 2px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
      position: relative;
      transition: all 0.2s ease;
    }
    .package-card:hover {
      border-color: #0084ff;
      background: #f8fbff;
      transform: translateY(-1px);
    }
    .package-card.selected {
      border-color: #0084ff;
      background: #ebf5ff;
      box-shadow: 0 0 0 1px #0084ff, 0 4px 12px rgba(0, 132, 255, 0.15);
    }
    .package-left {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .package-name {
      font-size: 17px;
      font-weight: 800;
      color: #003366;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .package-duration {
      font-size: 13px;
      color: #64748b;
    }
    .package-badge {
      font-size: 11px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 12px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .badge-best {
      background: #fef3c7;
      color: #92400e;
      border: 1px solid #fde68a;
    }
    .badge-popular {
      background: #dbeafe;
      color: #1e40af;
      border: 1px solid #bfdbfe;
    }
    .badge-starter {
      background: #f1f5f9;
      color: #475569;
      border: 1px solid #e2e8f0;
    }
    .package-right {
      text-align: right;
    }
    .package-coins {
      font-size: 18px;
      font-weight: 800;
      color: #b78103;
    }
    .package-cad {
      font-size: 12px;
      color: #64748b;
      margin-top: 2px;
    }
    .summary-box {
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      border-radius: 10px;
      padding: 14px 16px;
      margin-bottom: 20px;
      font-size: 14px;
      line-height: 1.6;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
    }
    .summary-row:last-child {
      margin-bottom: 0;
      padding-top: 6px;
      border-top: 1px solid #e2e8f0;
      font-weight: 700;
    }
    .summary-label {
      color: #64748b;
    }
    .summary-val {
      color: #1e293b;
    }
    .text-insufficient {
      color: #dc2626 !important;
    }
  </style>
</head>
<body>
  <div class="header-banner">
    <h1>Club Penguin Membership</h1>
    <p>Upgrade your penguin with coins to unlock member igloos, exclusive items, and adventures!</p>
    <div class="timeline-badge">Timeline Date: ${timelineDate}</div>
  </div>

  <div class="card">
    ${betaDisabled ? `
    <div class="beta-warning">
      <strong>Membership Unavailable During Beta Testing</strong>
      Club Penguin is currently in its pre-launch Beta period (prior to October 24, 2005). Paid memberships have not been introduced yet, and all beta testing penguins enjoy open access!
    </div>
    ` : ''}

    ${isPostIncrease ? `
    <div class="price-notice">
      <strong>July 13, 2011 Pricing Update:</strong> Official Club Penguin membership packages are updated to the 2011 revised rates.
    </div>
    ` : ''}

    <div id="alertBox" class="alert"></div>

    <!-- Login Form -->
    <div id="loginSection">
      <div class="form-group">
        <label for="username">Penguin Username</label>
        <input type="text" id="username" placeholder="e.g. Penguin123" autocomplete="username">
      </div>
      <div class="form-group">
        <label for="password">Password</label>
        <input type="password" id="password" placeholder="Enter your password" autocomplete="current-password">
      </div>
      <button class="btn" id="loginBtn" onclick="handleLogin()">Log In with Penguin</button>
    </div>

    <!-- Membership Purchase Section -->
    <div id="purchaseSection" style="display: none;">
      <div class="profile-box">
        <div class="profile-row">
          <span class="profile-name" id="profileName">Penguin</span>
          <span class="coins-badge"><span id="profileCoins">0</span> Coins</span>
        </div>
        <div class="profile-row">
          <span style="font-size: 13px; color: #666;">Status:</span>
          <span id="profileStatus" class="status-badge status-nonmember">Non-Member</span>
        </div>
        <div class="profile-row" id="expiryRow" style="display: none;">
          <span style="font-size: 13px; color: #666;">Expires:</span>
          <span id="profileExpiry" style="font-size: 13px; font-weight: 600; color: #333;">-</span>
        </div>
      </div>

      <div class="packages-title">Choose a Membership Package:</div>
      <div class="packages-container" id="packagesContainer">
        ${packs.map((p, idx) => {
          let badgeHtml = '';
          if (p.id === '12_months') {
            badgeHtml = '<span class="package-badge badge-best">Best Value</span>';
          } else if (p.id === '6_months') {
            badgeHtml = '<span class="package-badge badge-popular">Popular</span>';
          } else {
            badgeHtml = '<span class="package-badge badge-starter">Standard</span>';
          }
          return `
          <div class="package-card ${idx === 0 ? 'selected' : ''}" data-id="${p.id}" onclick="selectPackage('${p.id}')">
            <div class="package-left">
              <div class="package-name">
                ${p.name}
                ${badgeHtml}
              </div>
              <div class="package-duration">${p.days} Days of Full Membership Access</div>
            </div>
            <div class="package-right">
              <div class="package-coins">${p.coins.toLocaleString()} Coins</div>
              <div class="package-cad">$${p.cadPrice.toFixed(2)} CAD</div>
            </div>
          </div>
          `;
        }).join('')}
      </div>

      <div class="summary-box">
        <div class="summary-row">
          <span class="summary-label">Selected Package:</span>
          <span class="summary-val" id="summaryPackageName">${packs[0]?.name ?? '1 Month'}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Cost:</span>
          <span class="summary-val" id="summaryCost">${packs[0]?.coins.toLocaleString() ?? '595'} Coins ($${packs[0]?.cadPrice.toFixed(2) ?? '5.95'} CAD)</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Coins Remaining:</span>
          <span class="summary-val" id="summaryRemaining">-</span>
        </div>
      </div>

      <button class="btn" id="buyBtn" onclick="handleBuy()" ${betaDisabled ? 'disabled' : ''}>
        ${betaDisabled ? 'Unavailable in Beta Period' : 'Buy Membership'}
      </button>

      <button class="btn btn-secondary" onclick="handleLogout()">Switch Penguin</button>
    </div>
  </div>

  <script>
    const BETA_DISABLED = ${betaDisabled};
    const PACKAGES = ${JSON.stringify(packs)};
    let selectedPackageId = '${packs[0]?.id ?? '1_month'}';
    let currentUser = null;
    let savedPassword = '';

    function showAlert(msg, isSuccess = false) {
      const box = document.getElementById('alertBox');
      box.textContent = msg;
      box.className = 'alert ' + (isSuccess ? 'alert-success' : 'alert-error');
      box.style.display = 'block';
    }

    function hideAlert() {
      document.getElementById('alertBox').style.display = 'none';
    }

    async function handleLogin() {
      hideAlert();
      const user = document.getElementById('username').value.trim();
      const pass = document.getElementById('password').value;
      if (!user) {
        showAlert('Please enter your penguin username.');
        return;
      }

      const btn = document.getElementById('loginBtn');
      btn.disabled = true;
      btn.textContent = 'Logging in...';

      try {
        const res = await fetch('/api/membership/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: user, password: pass })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          showAlert(data.error || 'Failed to log in.');
          return;
        }

        currentUser = data.penguin;
        savedPassword = pass;
        renderProfile();
      } catch (e) {
        showAlert('Network error connecting to server.');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Log In with Penguin';
      }
    }

    function renderProfile() {
      if (!currentUser) return;
      document.getElementById('loginSection').style.display = 'none';
      document.getElementById('purchaseSection').style.display = 'block';

      document.getElementById('profileName').textContent = currentUser.name;
      document.getElementById('profileCoins').textContent = currentUser.coins.toLocaleString();

      const statusBadge = document.getElementById('profileStatus');
      const expiryRow = document.getElementById('expiryRow');
      const expiryText = document.getElementById('profileExpiry');

      if (currentUser.isMember) {
        statusBadge.textContent = 'Active Member';
        statusBadge.className = 'status-badge status-member';
        expiryRow.style.display = 'flex';
        expiryText.textContent = currentUser.expiryDateString;
      } else {
        statusBadge.textContent = 'Non-Member';
        statusBadge.className = 'status-badge status-nonmember';
        expiryRow.style.display = 'none';
      }

      updateSummary();
    }

    function selectPackage(packageId) {
      selectedPackageId = packageId;
      document.querySelectorAll('.package-card').forEach(el => {
        if (el.getAttribute('data-id') === packageId) {
          el.classList.add('selected');
        } else {
          el.classList.remove('selected');
        }
      });
      updateSummary();
    }

    function updateSummary() {
      const pack = PACKAGES.find(p => p.id === selectedPackageId) || PACKAGES[0];
      if (!pack) return;

      document.getElementById('summaryPackageName').textContent = pack.name + ' (' + pack.days + ' Days)';
      document.getElementById('summaryCost').textContent = pack.coins.toLocaleString() + ' Coins ($' + pack.cadPrice.toFixed(2) + ' CAD)';

      const remainingEl = document.getElementById('summaryRemaining');
      const buyBtn = document.getElementById('buyBtn');

      if (currentUser) {
        const remaining = currentUser.coins - pack.coins;
        if (remaining < 0) {
          remainingEl.textContent = remaining.toLocaleString() + ' (Need ' + Math.abs(remaining).toLocaleString() + ' more coins)';
          remainingEl.className = 'summary-val text-insufficient';
          if (!BETA_DISABLED) {
            buyBtn.disabled = true;
            buyBtn.textContent = 'Insufficient Coins';
          }
        } else {
          remainingEl.textContent = remaining.toLocaleString() + ' Coins';
          remainingEl.className = 'summary-val';
          if (!BETA_DISABLED) {
            buyBtn.disabled = false;
            buyBtn.textContent = 'Buy ' + pack.name + ' (' + pack.coins.toLocaleString() + ' Coins)';
          }
        }
      }
    }

    async function handleBuy() {
      if (BETA_DISABLED) {
        showAlert('Membership is not available prior to October 24, 2005.');
        return;
      }

      hideAlert();
      const pack = PACKAGES.find(p => p.id === selectedPackageId) || PACKAGES[0];
      if (!pack) {
        showAlert('Please select a membership package.');
        return;
      }

      if (currentUser.coins < pack.coins) {
        showAlert('You do not have enough coins! You have ' + currentUser.coins.toLocaleString() + ' coins, but need ' + pack.coins.toLocaleString() + '.');
        return;
      }

      const btn = document.getElementById('buyBtn');
      btn.disabled = true;
      btn.textContent = 'Processing Purchase...';

      try {
        const res = await fetch('/api/membership/buy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: currentUser.name,
            password: savedPassword,
            packageId: pack.id
          })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          showAlert(data.error || 'Purchase failed.');
          return;
        }

        currentUser.coins = data.remainingCoins;
        currentUser.isMember = true;
        currentUser.expiryDateString = data.newExpiry;
        renderProfile();

        showAlert('Successfully purchased ' + data.packageName + ' (' + data.daysAdded + ' days) for ' + data.coinsSpent.toLocaleString() + ' coins ($' + data.cadPrice.toFixed(2) + ' CAD)! Expiry: ' + data.newExpiry, true);
      } catch (e) {
        showAlert('Error communicating with server.');
      } finally {
        updateSummary();
      }
    }

    function handleLogout() {
      currentUser = null;
      savedPassword = '';
      hideAlert();
      document.getElementById('password').value = '';
      document.getElementById('purchaseSection').style.display = 'none';
      document.getElementById('loginSection').style.display = 'block';
    }
  </script>
</body>
</html>`;
}
