const TOKEN_KEY = "versuz_token";
const USER_KEY = "versuz_user";

function showAlert(el, message, type = "error") {
  if (!el) return;
  el.textContent = message;
  el.className = `alert show alert-${type}`;
}

function hideAlert(el) {
  if (!el) return;
  el.className = "alert";
}

function setLoading(btn, isLoading) {
  if (!btn) return;
  btn.disabled = isLoading;
  btn.classList.toggle("loading", isLoading);
}

function saveSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token || "guest");
  localStorage.setItem(USER_KEY, JSON.stringify(user || { name: "Guest", role: "Guest" }));
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function getCurrentUserId() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    const user = JSON.parse(raw);
    return user.id || user.user_id || null;
  } catch {
    return null;
  }
}

async function parseJsonSafe(res) {
  try { return await res.json(); } catch { return null; }
}

// Normalizes a sport object coming from the API into a consistent { id, name } shape,
// regardless of whether the backend returns id/name or sport_id/sport_name.
function normalizeSport(s) {
  const id = s.id ?? s.sport_id;
  const name = s.name ?? s.sport_name;
  return { id, name };
}

async function handleLogin(event) {
  event.preventDefault();
  const form = event.target;
  const alertEl = document.getElementById("authAlert");
  const btn = document.getElementById("loginBtn");
  hideAlert(alertEl);

  const email = form.email.value.trim();
  const password = form.password.value;

  if (!email || !password) {
    showAlert(alertEl, "Enter both your email and password.");
    return;
  }

  setLoading(btn, true);
  try {
    const res = await fetch(API_ENDPOINTS.login, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await parseJsonSafe(res);

    if (!res.ok) {
      showAlert(alertEl, (data && (data.message || data.error)) || "Couldn't sign in. Check your details and try again.");
      return;
    }

    saveSession(data.token, data.data || data.user);

    if (data.data && data.data.onboarding_completed === false) {
      window.location.href = "onboarding.html";
    } else {
      window.location.href = "dashboard.html";
    }
  } catch {
    showAlert(alertEl, "Couldn't reach the Versuz server. Is your backend running?");
  } finally {
    setLoading(btn, false);
  }
}

async function handleSignup(event) {
  event.preventDefault();
  const form = event.target;
  const alertEl = document.getElementById("authAlert");
  const btn = document.getElementById("signupBtn");
  hideAlert(alertEl);

  const name = form.name.value.trim();
  const email = form.email.value.trim();
  const password = form.password.value;
  const confirm = form.confirmPassword.value;

  if (!name || !email || !password) {
    showAlert(alertEl, "Fill in your name, email, and password.");
    return;
  }
  if (password.length < 6) {
    showAlert(alertEl, "Password must be at least 6 characters.");
    return;
  }
  if (password !== confirm) {
    showAlert(alertEl, "Passwords don't match.");
    return;
  }

  setLoading(btn, true);
  try {
    const res = await fetch(API_ENDPOINTS.register, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: name, email, password }),
    });
    const data = await parseJsonSafe(res);

    if (!res.ok) {
      showAlert(alertEl, (data && (data.message || data.error)) || "Couldn't create your account. Try a different email.");
      return;
    }

    if (data && data.token) {
      saveSession(data.token, data.data || data.user);

      if (data.joinedTeamId) {
        window.location.href = `teams.html?id=${data.joinedTeamId}`;
      } else {
        window.location.href = "onboarding.html";
      }
    } else {
      showAlert(alertEl, "Account created. You can sign in now.", "success");
      setTimeout(() => (window.location.href = "index.html"), 1200);
    }
  } catch {
    showAlert(alertEl, "Couldn't reach the Versuz server. Is your backend running?");
  } finally {
    setLoading(btn, false);
  }
}

async function handleForgotPassword(event) {
  event.preventDefault();
  const form = event.target;
  const alertEl = document.getElementById("forgotAlert");
  const btn = document.getElementById("forgotBtn");
  hideAlert(alertEl);

  const email = form.email.value.trim();
  if (!email) {
    showAlert(alertEl, "Enter the email on your account.");
    return;
  }

  setLoading(btn, true);
  try {
    const res = await fetch(API_ENDPOINTS.forgotPassword, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await parseJsonSafe(res);

    if (!res.ok) {
      showAlert(alertEl, (data && (data.message || data.error)) || "Couldn't send the reset link.");
      return;
    }

    if (data && data.devResetURL) {
      showAlert(alertEl, "Reset link (dev mode):", "info");
      const link = document.createElement("a");
      link.href = data.devResetURL;
      link.textContent = "Open reset link";
      link.className = "link-accent";
      link.style.marginLeft = "4px";
      alertEl.appendChild(link);
    } else {
      showAlert(alertEl, (data && data.message) || "Check your inbox for a reset link.", "success");
    }
  } catch {
    showAlert(alertEl, "Couldn't reach the Versuz server. Is your backend running?");
  } finally {
    setLoading(btn, false);
  }
}

async function handleResetPassword(event) {
  event.preventDefault();
  const form = event.target;
  const alertEl = document.getElementById("resetAlert");
  const btn = document.getElementById("resetBtn");
  hideAlert(alertEl);

  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

  if (!token) {
    showAlert(alertEl, "This reset link is missing its token. Request a new one.");
    return;
  }

  const password = form.password.value;
  const confirm = form.confirmPassword.value;

  if (password.length < 6) {
    showAlert(alertEl, "Password must be at least 6 characters.");
    return;
  }
  if (password !== confirm) {
    showAlert(alertEl, "Passwords don't match.");
    return;
  }

  setLoading(btn, true);
  try {
    const res = await fetch(API_ENDPOINTS.resetPassword, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await parseJsonSafe(res);

    if (!res.ok) {
      showAlert(alertEl, (data && (data.message || data.error)) || "That reset link is invalid or has expired.");
      return;
    }

    showAlert(alertEl, "Password reset. Redirecting you to sign in...", "success");
    setTimeout(() => (window.location.href = "index.html"), 1500);
  } catch {
    showAlert(alertEl, "Couldn't reach the Versuz server. Is your backend running?");
  } finally {
    setLoading(btn, false);
  }
}

function continueAsGuest() {
  saveSession(null, { name: "Guest", role: "Guest" });
  window.location.href = "dashboard.html";
}

function logout() {
  clearSession();
  window.location.href = "index.html";
}

function requireAuth() {
  if (!getToken()) {
    window.location.href = "index.html";
  }
}

function renderCurrentUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return;
  try {
    const user = JSON.parse(raw);
    const whoEl = document.querySelector(".sidebar-foot .who");
    const roleEl = document.querySelector(".sidebar-foot .role");
    const avatarEl = document.querySelector(".sidebar-foot .avatar-ring");
    if (whoEl) whoEl.textContent = user.full_name || user.name || "Guest";
    if (roleEl) roleEl.textContent = user.role || "Guest";
    if (avatarEl) {
      const initials = (user.full_name || user.name || "GU")
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
      avatarEl.textContent = initials;
    }
  } catch {
  }
}

function openForgotPasswordModal() {
  const modal = document.getElementById("forgotModal");
  if (modal) modal.style.display = "flex";
}

function closeForgotPasswordModal() {
  const modal = document.getElementById("forgotModal");
  if (modal) modal.style.display = "none";
}

async function loadSportsIntoOnboardingForm() {
  const listEl = document.getElementById("sportsCheckboxList");
  const teamSportSelect = document.getElementById("teamSport");
  if (!listEl) return;

  try {
    const res = await fetch(API_ENDPOINTS.sports);
    const data = await parseJsonSafe(res);
    const rawSports = (data && data.data) || [];
    const sports = rawSports.map(normalizeSport).filter(s => s.id != null && s.name);

    if (sports.length === 0) {
      listEl.innerHTML = `<span style="font-size:.8rem;color:var(--text-mute);">No sports available.</span>`;
      return;
    }

    listEl.innerHTML = sports.map(s => `
      <label class="flex gap-8" style="align-items:center;font-size:.85rem;">
        <input type="checkbox" name="sport" value="${s.id}"> ${s.name}
      </label>
    `).join("");

    if (teamSportSelect) {
      teamSportSelect.innerHTML = `<option value="">Select a sport</option>` +
        sports.map(s => `<option value="${s.id}">${s.name}</option>`).join("");
    }
  } catch {
    listEl.innerHTML = `<span style="font-size:.8rem;color:var(--text-mute);">Couldn't load sports.</span>`;
  }
}

function addMemberEmailField() {
  const container = document.getElementById("memberEmailsList");
  const div = document.createElement("div");
  div.className = "field";
  div.style.marginBottom = "8px";
  div.innerHTML = `<input type="email" name="memberEmail" placeholder="teammate@club.com" style="margin-bottom:0;">`;
  container.appendChild(div);
}

function skipOnboarding() {
  window.location.href = "dashboard.html";
}

async function handleOnboardingSubmit(event) {
  event.preventDefault();
  const alertEl = document.getElementById("onboardingAlert");
  const btn = document.getElementById("onboardingBtn");
  hideAlert(alertEl);

  const role = document.querySelector('input[name="role"]:checked').value;

  // Parse checked sport checkboxes, then strip out anything that didn't parse to a
  // valid integer (e.g. if a checkbox value was ever "" or "undefined").
  const sportIds = Array.from(document.querySelectorAll('input[name="sport"]:checked'))
    .map(cb => parseInt(cb.value, 10))
    .filter(id => Number.isInteger(id));

  if (sportIds.length === 0) {
    showAlert(alertEl, "Select at least one sport.");
    return;
  }

  const payload = { role, sport_ids: sportIds };
  let redirectTeamId = null;

  if (role === "Captain") {
    const teamName = document.getElementById("teamName").value.trim();
    const teamSportIdRaw = document.getElementById("teamSport").value;
    const teamSportId = parseInt(teamSportIdRaw, 10);
    if (!teamName || !Number.isInteger(teamSportId)) {
      showAlert(alertEl, "Enter a team name and select a team sport.");
      return;
    }
    payload.team_name = teamName;
    payload.team_sport_id = teamSportId;

    const memberEmails = Array.from(document.querySelectorAll('input[name="memberEmail"]'))
      .map(input => input.value.trim())
      .filter(Boolean);
    payload.member_emails = memberEmails;
  }

  setLoading(btn, true);
  try {
    const res = await fetch(API_ENDPOINTS.onboarding, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`
      },
      body: JSON.stringify(payload),
    });
    const data = await parseJsonSafe(res);

    if (!res.ok) {
      showAlert(alertEl, (data && (data.message || data.error)) || "Couldn't complete setup.");
      return;
    }

    if (data.data && data.data.team) {
      redirectTeamId = data.data.team.id;
    }

    showAlert(alertEl, "All set! Redirecting...", "success");
    setTimeout(() => {
      window.location.href = redirectTeamId
        ? `teams.html?id=${redirectTeamId}`
        : "dashboard.html";
    }, 1000);
  } catch {
    showAlert(alertEl, "Couldn't reach the Versuz server. Is your backend running?");
  } finally {
    setLoading(btn, false);
  }
}

function dashInitials(name) {
  return (name || "??")
    .split(" ")
    .map(w => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatDateTime(dateStr, timeStr) {
  const d = new Date(timeStr || dateStr);
  if (isNaN(d)) return "";
  return d.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
}

function matchupCard({ leftName, leftMeta, rightName, rightMeta, statusHtml }) {
  return `
    <div class="vs-card">
      <div class="vs-side">
        <div class="vs-badge">${dashInitials(leftName)}</div>
        <div class="vs-team"><div class="name">${leftName}</div><div class="meta">${leftMeta}</div></div>
      </div>
      <div class="vs-center">${statusHtml}</div>
      <div class="vs-side right">
        <div class="vs-badge">${dashInitials(rightName)}</div>
        <div class="vs-team"><div class="name">${rightName}</div><div class="meta">${rightMeta}</div></div>
      </div>
    </div>`;
}

async function loadDashboard() {
  const list = document.getElementById("matchupsList");
  const topTeamsList = document.getElementById("topTeamsList");
  const sportsTags = document.getElementById("sportsTags");
  if (!list) return;

  try {
    const res = await fetch(API_ENDPOINTS.userDashboard, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    const result = await parseJsonSafe(res);

    if (!res.ok) {
      list.innerHTML = `<p style="color:var(--text-mute);font-size:.85rem;">Couldn't load dashboard data.</p>`;
      return;
    }

    const data = result.data;

    document.getElementById("statRecord").textContent = `${data.record.wins}–${data.record.losses}`;
    document.getElementById("statWinRate").textContent = `▲ ${data.record.win_rate}% win rate`;
    document.getElementById("statLiveCount").textContent = data.live_now.length;
    document.getElementById("statLiveLabel").textContent = data.live_now.length > 0
      ? `${data.live_now[0].team_a_name} vs ${data.live_now[0].team_b_name}`
      : "No live matches";
    document.getElementById("statUpcomingCount").textContent = data.upcoming_matches.length;
    document.getElementById("statUpcomingLabel").textContent = data.upcoming_matches.length > 0
      ? `next: ${formatDateTime(data.upcoming_matches[0].match_date, data.upcoming_matches[0].match_time)}`
      : "None scheduled";
    document.getElementById("statTeamsTracked").textContent = data.teams_tracked;
    document.getElementById("statTeamsDelta").textContent = "";

    let cards = "";

    data.live_now.forEach(m => {
      cards += matchupCard({
        leftName: m.team_a_name, leftMeta: "HOME",
        rightName: m.team_b_name, rightMeta: "AWAY",
        statusHtml: `<span class="vs-status live">Live</span>`
      });
    });

    data.upcoming_matches.forEach(m => {
      cards += matchupCard({
        leftName: m.team_a_name, leftMeta: formatDateTime(m.match_date, m.match_time),
        rightName: m.team_b_name, rightMeta: "",
        statusHtml: `<span class="vs-status upcoming">Upcoming</span><div class="vs-mark">VS</div>`
      });
    });

    data.recent_completed_matches.forEach(m => {
      const leftWon = m.winner_team_id === m.team_a_id;
      const rightWon = m.winner_team_id === m.team_b_id;
      cards += matchupCard({
        leftName: m.team_a_name, leftMeta: leftWon ? "WON" : rightWon ? "LOST" : "DRAW",
        rightName: m.team_b_name, rightMeta: rightWon ? "WON" : leftWon ? "LOST" : "DRAW",
        statusHtml: `<span class="vs-status final">Final</span><div class="vs-score">${m.team_a_score} <span style="color:var(--text-mute);">–</span> ${m.team_b_score}</div>`
      });
    });

    list.innerHTML = cards || `<p style="color:var(--text-mute);font-size:.85rem;">No matches yet.</p>`;

    if (data.top_teams.length > 0) {
      topTeamsList.innerHTML = data.top_teams.map((t, i) => `
        <div class="list-row">
          <div class="flex gap-12" style="align-items:center;">
            <div class="vs-badge">${dashInitials(t.name)}</div>
            <div><div style="font-weight:700;">${t.name}</div><div class="mono" style="font-size:.72rem;color:var(--text-mute);">${t.sport_name}</div></div>
          </div>
          <span class="tag ${i === 0 ? 'win' : ''}">${i + 1}${['st','nd','rd'][i] || 'th'}</span>
        </div>`).join("");
    } else {
      topTeamsList.innerHTML = `<p style="color:var(--text-mute);font-size:.85rem;padding:12px;">No teams yet.</p>`;
    }

    sportsTags.innerHTML = data.sports_played.length > 0
      ? data.sports_played.map(s => `<span class="tag">${s}</span>`).join("")
      : `<p style="color:var(--text-mute);font-size:.85rem;">No sports yet.</p>`;

  } catch (err) {
    console.error("Dashboard load error:", err);
    list.innerHTML = `<p style="color:var(--text-mute);font-size:.85rem;">Couldn't reach the Versuz server.</p>`;
  }
}

function teamInitials(name) {
  return (name || "??")
    .split(" ")
    .map(w => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function teamGradient(index) {
  const gradients = [
    "linear-gradient(135deg,var(--blue),var(--blue-dim))",
    "linear-gradient(135deg,var(--coral),var(--coral-dim))",
    "linear-gradient(135deg,#7B61FF,#3B2A8C)",
    "linear-gradient(135deg,#35D07F,#1B7A47)",
  ];
  return gradients[index % gradients.length];
}

async function loadMyTeams() {
  const grid = document.getElementById("teamsGrid");
  if (!grid) return;

  try {
    const res = await fetch(API_ENDPOINTS.myTeams, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    const result = await parseJsonSafe(res);

    if (!res.ok) {
      grid.innerHTML = `<p style="color:var(--text-mute);font-size:.85rem;">Couldn't load your teams.</p>`;
      return;
    }

    const teams = result.data || [];

    let cards = teams.map((t, i) => {
      const year = new Date(t.created_at).getFullYear();
      const rankColor = t.rank === 1 ? "color:var(--win);" : "";
      return `
        <div class="card">
          <div class="flex gap-12" style="align-items:center;margin-bottom:16px;">
            <div class="vs-badge" style="width:52px;height:52px;font-size:1.1rem;background:${teamGradient(i)};">${teamInitials(t.name)}</div>
            <div>
              <h3 style="text-transform:none;">${t.name}</h3>
              <p class="mono" style="font-size:.75rem;color:var(--text-mute);">${t.sport_name} · Est. ${year}</p>
            </div>
          </div>
          <div class="flex" style="justify-content:space-between;margin-bottom:14px;">
            <div><div class="eyebrow">RECORD</div><div style="font-weight:800;">${t.wins}–${t.losses}</div></div>
            <div><div class="eyebrow">RANK</div><div style="font-weight:800;${rankColor}">#${t.rank}</div></div>
            <div><div class="eyebrow">MEMBERS</div><div style="font-weight:800;">${t.member_count}</div></div>
          </div>
          <button class="btn btn-ghost btn-block btn-sm" onclick="window.location.href='teams.html?id=${t.id}'">Manage Roster</button>
        </div>`;
    }).join("");

    cards += `
      <div class="card" style="display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;border-style:dashed;color:var(--text-mute);cursor:pointer;" onclick="openCreateTeamModal()">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
        <span style="font-weight:700;">Create a new team</span>
      </div>`;

    grid.innerHTML = teams.length > 0
      ? cards
      : `<p style="color:var(--text-mute);font-size:.85rem;">You're not part of any team yet.</p>` + cards;

  } catch (err) {
    console.error("Load teams error:", err);
    grid.innerHTML = `<p style="color:var(--text-mute);font-size:.85rem;">Couldn't reach the Versuz server.</p>`;
  }
}

async function openCreateTeamModal() {
  const modal = document.getElementById("createTeamModal");
  if (!modal) return;
  modal.style.display = "flex";

  const sportSelect = document.getElementById("newTeamSport");
  try {
    const res = await fetch(API_ENDPOINTS.sports);
    const data = await parseJsonSafe(res);
    const rawSports = (data && data.data) || [];
    const sports = rawSports.map(normalizeSport).filter(s => s.id != null && s.name);
    sportSelect.innerHTML = `<option value="">Select a sport</option>` +
      sports.map(s => `<option value="${s.id}">${s.name}</option>`).join("");
  } catch {
    sportSelect.innerHTML = `<option value="">Couldn't load sports</option>`;
  }
}

function closeCreateTeamModal() {
  const modal = document.getElementById("createTeamModal");
  if (modal) modal.style.display = "none";
}

async function handleCreateTeamSubmit(event) {
  event.preventDefault();
  const alertEl = document.getElementById("createTeamAlert");
  const btn = document.getElementById("createTeamBtn");
  hideAlert(alertEl);

  const name = document.getElementById("newTeamName").value.trim();
  const sportId = document.getElementById("newTeamSport").value;

  if (!name || !sportId) {
    showAlert(alertEl, "Enter a team name and select a sport.");
    return;
  }

  setLoading(btn, true);
  try {
    const res = await fetch(API_ENDPOINTS.createTeam, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`
      },
      body: JSON.stringify({ name, sport_id: parseInt(sportId) }),
    });
    const data = await parseJsonSafe(res);

    if (!res.ok) {
      showAlert(alertEl, (data && (data.message || data.error)) || "Couldn't create the team.");
      return;
    }

    showAlert(alertEl, "Team created!", "success");
    setTimeout(() => {
      closeCreateTeamModal();
      loadMyTeams();
    }, 800);
  } catch {
    showAlert(alertEl, "Couldn't reach the Versuz server.");
  } finally {
    setLoading(btn, false);
  }
}

async function loadTeamRoster(teamId) {
  const alertEl = document.getElementById("rosterAlert");
  const membersList = document.getElementById("rosterMembersList");
  hideAlert(alertEl);

  try {
    const res = await fetch(API_ENDPOINTS.teamDetail(teamId), {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    const result = await parseJsonSafe(res);

    if (!res.ok) {
      showAlert(alertEl, (result && result.message) || "Couldn't load this team.");
      membersList.innerHTML = "";
      return;
    }

    const team = result.data;

    document.getElementById("rosterTeamName").textContent = team.name;
    document.getElementById("rosterSportLabel").textContent = team.sport_name.toUpperCase();
    document.getElementById("rosterRecord").textContent = `${team.wins}–${team.losses}`;
    document.getElementById("rosterRating").textContent = team.rating;
    document.getElementById("rosterMemberCount").textContent = team.members.length;

    membersList.innerHTML = team.members.map(m => `
      <div class="list-row">
        <div class="flex gap-12" style="align-items:center;">
          <div class="vs-badge">${teamInitials(m.full_name)}</div>
          <div>
            <div style="font-weight:700;">${m.full_name}${m.user_id === team.captain_id ? ' <span class="tag win" style="margin-left:6px;font-size:.65rem;">Captain</span>' : ''}</div>
            <div class="mono" style="font-size:.72rem;color:var(--text-mute);">${m.email}${m.jersey_number != null ? ' · #' + m.jersey_number : ''}</div>
          </div>
        </div>
        ${team.is_captain && m.user_id !== team.captain_id
          ? `<button class="btn btn-ghost btn-sm" onclick="handleRemoveMember(${teamId}, ${m.user_id})">Remove</button>`
          : ''}
      </div>
    `).join("");

    if (team.is_captain) {
      document.getElementById("addMemberBlock").style.display = "block";
      const addForm = document.getElementById("addMemberForm");
      addForm.onsubmit = (e) => handleAddMemberSubmit(e, teamId);
    }

    // Wire up Leave Team (anyone) and Delete Team (captain only)
    const leaveBtn = document.getElementById("leaveTeamBtn");
    const deleteBtn = document.getElementById("deleteTeamBtn");

    if (leaveBtn) {
      leaveBtn.style.display = "inline-flex";
      leaveBtn.onclick = () => handleLeaveTeam(teamId, team.name);
    }

    if (deleteBtn) {
      deleteBtn.style.display = team.is_captain ? "inline-flex" : "none";
      deleteBtn.onclick = () => handleDeleteTeam(teamId, team.name);
    }

  } catch (err) {
    console.error("Load roster error:", err);
    showAlert(alertEl, "Couldn't reach the Versuz server.");
  }
}

async function handleAddMemberSubmit(event, teamId) {
  event.preventDefault();
  const alertEl = document.getElementById("rosterAlert");
  const btn = document.getElementById("addMemberBtn");
  const emailInput = document.getElementById("addMemberEmail");
  hideAlert(alertEl);

  const email = emailInput.value.trim();
  if (!email) return;

  setLoading(btn, true);
  try {
    const res = await fetch(API_ENDPOINTS.addTeamMember, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`
      },
      body: JSON.stringify({ team_id: teamId, email }),
    });
    const data = await parseJsonSafe(res);

    if (!res.ok) {
      showAlert(alertEl, (data && data.message) || "Couldn't add that member.");
      return;
    }

    showAlert(alertEl, data.message, "success");
    emailInput.value = "";
    loadTeamRoster(teamId);
  } catch {
    showAlert(alertEl, "Couldn't reach the Versuz server.");
  } finally {
    setLoading(btn, false);
  }
}

async function handleRemoveMember(teamId, playerId) {
  const alertEl = document.getElementById("rosterAlert");
  hideAlert(alertEl);

  try {
    const res = await fetch(API_ENDPOINTS.removeTeamMember, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`
      },
      body: JSON.stringify({ team_id: teamId, player_id: playerId }),
    });
    const data = await parseJsonSafe(res);

    if (!res.ok) {
      showAlert(alertEl, (data && data.message) || "Couldn't remove that member.");
      return;
    }

    loadTeamRoster(teamId);
  } catch {
    showAlert(alertEl, "Couldn't reach the Versuz server.");
  }
}

async function handleDeleteTeam(teamId, teamName) {
  const alertEl = document.getElementById("rosterAlert");
  hideAlert(alertEl);

  const confirmed = window.confirm(
    `Delete ${teamName || "this team"} permanently? This removes all members, stats, and pending invites. This cannot be undone.`
  );
  if (!confirmed) return;

  try {
    const res = await fetch(API_ENDPOINTS.deleteTeam(teamId), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    const data = await parseJsonSafe(res);

    if (!res.ok) {
      showAlert(alertEl, (data && data.message) || "Couldn't delete this team.");
      return;
    }

    window.location.href = "teams.html";
  } catch {
    showAlert(alertEl, "Couldn't reach the Versuz server.");
  }
}

async function handleLeaveTeam(teamId, teamName) {
  const alertEl = document.getElementById("rosterAlert");
  hideAlert(alertEl);

  const confirmed = window.confirm(
    `Leave ${teamName || "this team"}? If you're the captain, captaincy will pass to another member, or the team will be deleted if you're the last one on it.`
  );
  if (!confirmed) return;

  try {
    const res = await fetch(API_ENDPOINTS.leaveTeam(teamId), {
      method: "POST",
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    const data = await parseJsonSafe(res);

    if (!res.ok) {
      showAlert(alertEl, (data && data.message) || "Couldn't leave this team.");
      return;
    }

    window.location.href = "teams.html";
  } catch {
    showAlert(alertEl, "Couldn't reach the Versuz server.");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const createTeamForm = document.getElementById("createTeamForm");
  if (createTeamForm) {
    createTeamForm.addEventListener("submit", handleCreateTeamSubmit);
  }
});