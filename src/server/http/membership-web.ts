import { Router } from 'express';
import express from 'express';
import { GameData } from '@server/timelines/game-data';
import { SettingsManager } from '@server/settings';
import { PenguinRepository } from '@server/database/database';
import { WorldServer } from '@server/socket-server/world-server';
import { verifyPenguinPassword } from '@server/auth/password';
import {
  BETA_CUTOFF_DATE,
  calculateMembershipDays,
  calculateMembershipDurationMs,
  evaluateMembership,
  MIN_MEMBERSHIP_COINS,
  MAX_MEMBERSHIP_COINS
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
    res.json({
      timelineDate: currentDate,
      betaDisabled,
      minCoins: MIN_MEMBERSHIP_COINS,
      maxCoins: MAX_MEMBERSHIP_COINS
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
      betaDisabled
    });
  });

  // Purchase endpoint
  router.post('/api/membership/buy', async (req, res) => {
    const currentDate = gameData.getDate();
    if (isLower(currentDate, BETA_CUTOFF_DATE)) {
      res.status(403).json({ error: 'Membership is not available prior to October 24, 2005.' });
      return;
    }

    const { username, password, coins: rawCoins } = req.body ?? {};
    if (!username || typeof username !== 'string') {
      res.status(400).json({ error: 'Username is required.' });
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

    const coinsToSpend = typeof rawCoins === 'number' && !Number.isNaN(rawCoins)
      ? Math.floor(rawCoins)
      : (parseInt(rawCoins, 10) || 500);

    if (coinsToSpend < MIN_MEMBERSHIP_COINS) {
      res.status(400).json({ error: `Minimum purchase is ${MIN_MEMBERSHIP_COINS} coins.` });
      return;
    }

    const online = worldServer?.world.getById(id);
    const currentCoins = online ? online.currency.coins : penguinJson.coins;

    if (currentCoins < coinsToSpend) {
      res.status(400).json({
        error: `Insufficient coins. You have ${currentCoins.toLocaleString()} coins, but need ${coinsToSpend.toLocaleString()}.`
      });
      return;
    }

    const addedMs = calculateMembershipDurationMs(coinsToSpend);
    const now = Date.now();
    const currentExpiry = online
      ? online.membership.membershipExpires
      : penguinJson.membership_expires;

    const baseTime = (currentExpiry !== null && currentExpiry !== undefined && currentExpiry > now)
      ? currentExpiry
      : now;
    const newExpiry = baseTime + addedMs;

    let remainingCoins: number;

    if (online) {
      online.currency.discount(coinsToSpend);
      online.membership.setMembershipExpires(newExpiry);
      worldServer?.persister(online, true);
      remainingCoins = online.currency.coins;

      try {
        worldServer?.msg.send(online, 'ai', -1, online.currency.coins);
      } catch {}
    } else {
      penguinJson.coins -= coinsToSpend;
      penguinJson.membership_expires = newExpiry;
      await db.update(id, penguinJson);
      remainingCoins = penguinJson.coins;
    }

    const days = (addedMs / 86_400_000).toFixed(1);
    const expDate = new Date(newExpiry).toISOString().split('T')[0];

    res.json({
      success: true,
      coinsSpent: coinsToSpend,
      daysAdded: Number(days),
      newExpiry: expDate,
      remainingCoins
    });
  });

  // Serve the HTML webpage
  const renderWebpage = (_req: express.Request, res: express.Response) => {
    const currentDate = gameData.getDate();
    const betaDisabled = isLower(currentDate, BETA_CUTOFF_DATE);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(generateHtmlPage(currentDate, betaDisabled));
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

function generateHtmlPage(timelineDate: string, betaDisabled: boolean): string {
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
      max-width: 540px;
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
    /* Package buttons */
    .packages-title {
      font-size: 14px;
      font-weight: 600;
      color: #555;
      margin-bottom: 10px;
    }
    .packages-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      margin-bottom: 18px;
    }
    .package-btn {
      background: #ffffff;
      border: 2px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px 10px;
      text-align: center;
      cursor: pointer;
      transition: all 0.15s;
    }
    .package-btn:hover {
      border-color: #0084ff;
      background: #f5faff;
    }
    .package-btn.active {
      border-color: #0084ff;
      background: #ebf5ff;
      box-shadow: 0 0 0 1px #0084ff;
    }
    .package-coins {
      font-weight: 800;
      color: #b78103;
      font-size: 16px;
    }
    .package-days {
      font-size: 13px;
      color: #4b5563;
      margin-top: 2px;
    }
    .package-discount {
      font-size: 11px;
      color: #059669;
      font-weight: 700;
      margin-top: 4px;
    }
    .duration-preview {
      background: #f9fafb;
      border: 1px dashed #cbd5e1;
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 18px;
      font-size: 14px;
      color: #334155;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .duration-preview strong {
      color: #005a9c;
    }
  </style>
</head>
<body>
  <div class="header-banner">
    <h1>Club Penguin Membership</h1>
    <p>Upgrade your penguin with coins to unlock member igloos, outfits, and access!</p>
    <div class="timeline-badge">Timeline Date: ${timelineDate}</div>
  </div>

  <div class="card">
    ${betaDisabled ? `
    <div class="beta-warning">
      <strong>Membership Unavailable During Beta Testing</strong>
      Club Penguin is currently in its pre-launch Beta period (prior to October 24, 2005). Paid memberships have not been introduced yet, and all beta testing penguins enjoy open access!
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

      <div class="packages-title">Select a Coin Package:</div>
      <div class="packages-grid">
        <div class="package-btn active" onclick="selectPackage(500, this)">
          <div class="package-coins">500 Coins</div>
          <div class="package-days">1 Day</div>
        </div>
        <div class="package-btn" onclick="selectPackage(2500, this)">
          <div class="package-coins">2,500 Coins</div>
          <div class="package-days">~7.8 Days</div>
          <div class="package-discount">Bulk Discount</div>
        </div>
        <div class="package-btn" onclick="selectPackage(8000, this)">
          <div class="package-coins">8,000 Coins</div>
          <div class="package-days">~34.6 Days</div>
          <div class="package-discount">Popular</div>
        </div>
        <div class="package-btn" onclick="selectPackage(50000, this)">
          <div class="package-coins">50,000 Coins</div>
          <div class="package-days">365 Days (1 Year)</div>
          <div class="package-discount">Max Discount!</div>
        </div>
      </div>

      <div class="form-group">
        <label for="customCoins">Or Enter Custom Coin Amount (Min. 500):</label>
        <input type="number" id="customCoins" min="500" value="500" step="50" oninput="updateDurationPreview()">
      </div>

      <div class="duration-preview">
        <span>Duration Added:</span>
        <strong id="previewDuration">1.0 Day</strong>
      </div>

      <button class="btn" id="buyBtn" onclick="handleBuy()" ${betaDisabled ? 'disabled' : ''}>
        ${betaDisabled ? 'Unavailable in Beta Period' : 'Buy Membership'}
      </button>

      <button class="btn btn-secondary" onclick="handleLogout()">Switch Penguin</button>
    </div>
  </div>

  <script>
    const BETA_DISABLED = ${betaDisabled};
    let currentUser = null;
    let savedPassword = '';

    const DISCOUNT_EXPONENT = 1.281145;
    const MIN_COINS = 500;
    const MAX_COINS = 50000;

    function calcDays(coins) {
      if (coins < MIN_COINS) return 0;
      if (coins > MAX_COINS) {
        return 365 + (coins - MAX_COINS) * (365 / MAX_COINS);
      }
      return Math.pow(coins / MIN_COINS, DISCOUNT_EXPONENT);
    }

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

      updateDurationPreview();
    }

    function selectPackage(coins, el) {
      document.querySelectorAll('.package-btn').forEach(btn => btn.classList.remove('active'));
      if (el) el.classList.add('active');
      document.getElementById('customCoins').value = coins;
      updateDurationPreview();
    }

    function updateDurationPreview() {
      const val = parseInt(document.getElementById('customCoins').value, 10) || 500;
      const days = calcDays(val);
      const text = days >= 1 ? days.toFixed(1) + ' Days' : (days * 24).toFixed(0) + ' Hours';
      document.getElementById('previewDuration').textContent = text;
    }

    async function handleBuy() {
      if (BETA_DISABLED) {
        showAlert('Membership is not available prior to October 24, 2005.');
        return;
      }

      hideAlert();
      const coins = parseInt(document.getElementById('customCoins').value, 10) || 500;
      if (coins < MIN_COINS) {
        showAlert('Minimum purchase is 500 coins.');
        return;
      }
      if (currentUser.coins < coins) {
        showAlert('You do not have enough coins! You have ' + currentUser.coins.toLocaleString() + ' coins.');
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
            coins: coins
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

        showAlert('Successfully purchased ' + data.daysAdded + ' days of membership for ' + data.coinsSpent.toLocaleString() + ' coins! Expiry: ' + data.newExpiry, true);
      } catch (e) {
        showAlert('Error communicating with server.');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Buy Membership';
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

    // Initialize
    updateDurationPreview();
  </script>
</body>
</html>`;
}
