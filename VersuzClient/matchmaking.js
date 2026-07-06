// matchmaking.js
// Requires auth.js to be loaded first (uses getToken, showAlert, setLoading, parseJsonSafe).
// Requires these keys to exist in your config.js API_ENDPOINTS object:
//
//   matchmakingPool: (sportId) => `${API_BASE}/matches/pool${sportId ? `?sport_id=${sportId}` : ''}`,
//   toggleMatchmaking: `${API_BASE}/matches/pool/toggle`,
//   sendChallenge: `${API_BASE}/matches/challenge`,
//   pendingChallenges: `${API_BASE}/matches/challenge/pending`,
//   respondChallenge: `${API_BASE}/matches/challenge/respond`,
//
// Adjust API_BASE to match whatever base URL variable your config.js already uses.

function mmInitials(name) {
  return (name || "??")
    .split(" ")
    .map(w => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatChallengeDateTime(dateStr, timeStr) {
  const d = new Date(`${dateStr}T${timeStr}`);
  if (isNaN(d)) return `${dateStr} ${timeStr}`;
  return d.toLocaleString(undefined, {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit"
  });
}

// ---------- Matchmaking pool (browse teams looking for a match) ----------

async function loadMatchmakingPool(sportId) {
  const listEl = document.getElementById("matchmakingPoolList");
  if (!listEl) return;

  listEl.innerHTML = `<p style="color:var(--text-mute);font-size:.85rem;">Loading available teams...</p>`;

  try {
    const url = typeof API_ENDPOINTS.matchmakingPool === "function"
      ? API_ENDPOINTS.matchmakingPool(sportId)
      : API_ENDPOINTS.matchmakingPool;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    const result = await parseJsonSafe(res);

    if (!res.ok) {
      listEl.innerHTML = `<p style="color:var(--text-mute);font-size:.85rem;">Couldn't load the matchmaking pool.</p>`;
      return;
    }

    const teams = result.data || [];

    if (teams.length === 0) {
      listEl.innerHTML = `<p style="color:var(--text-mute);font-size:.85rem;">No teams are currently looking for a match.</p>`;
      return;
    }

    listEl.innerHTML = teams.map(t => `
      <div class="list-row">
        <div class="flex gap-12" style="align-items:center;">
          <div class="vs-badge">${mmInitials(t.team_name)}</div>
          <div>
            <div style="font-weight:700;">${t.team_name}</div>
            <div class="mono" style="font-size:.72rem;color:var(--text-mute);">
              ${t.sport_name} · ${t.wins ?? 0}–${t.losses ?? 0} · Rating ${t.rating ?? "—"}
            </div>
          </div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="openChallengeModal(${t.team_id}, '${(t.team_name || "").replace(/'/g, "\\'")}', ${t.sport_id})">
          Challenge
        </button>
      </div>
    `).join("");

  } catch (err) {
    console.error("Load matchmaking pool error:", err);
    listEl.innerHTML = `<p style="color:var(--text-mute);font-size:.85rem;">Couldn't reach the Versuz server.</p>`;
  }
}

async function handleToggleMatchmaking(teamId, isLooking) {
  const alertEl = document.getElementById("matchmakingAlert");
  hideAlert(alertEl);

  try {
    const res = await fetch(API_ENDPOINTS.toggleMatchmaking, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`
      },
      body: JSON.stringify({ team_id: teamId, is_looking: isLooking }),
    });
    const data = await parseJsonSafe(res);

    if (!res.ok) {
      showAlert(alertEl, (data && data.message) || "Couldn't update matchmaking status.");
      return;
    }

    showAlert(alertEl, data.message, "success");
  } catch {
    showAlert(alertEl, "Couldn't reach the Versuz server.");
  }
}

// ---------- "Looking for a match" toggle (roster view) ----------

// Self-contained: fetches the team's own detail record rather than relying on
// whatever loadTeamRoster() in app.js already stored, so it works regardless
// of that function's internals.
//
// ASSUMPTIONS (confirm against your actual API response and adjust the
// field names below if they differ):
//   - GET teamDetail(id) returns { data: { ..., is_looking, captain_id } }
//   - The logged-in user's id is available via a getCurrentUser()/decoded
//     token helper already defined in auth.js. If your helper has a
//     different name, swap it in below.
async function initRosterMatchmakingToggle(teamId) {
  const wrap = document.getElementById("matchmakingToggleWrap");
  const toggle = document.getElementById("matchmakingToggle");
  if (!wrap || !toggle) return;

  try {
    const res = await fetch(API_ENDPOINTS.teamDetail(teamId), {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    const result = await parseJsonSafe(res);
    if (!res.ok) return;

    const team = result.data || {};
    const currentUser = typeof getCurrentUser === "function" ? getCurrentUser() : null;
    const isCaptain = currentUser && team.captain_id != null
      ? String(team.captain_id) === String(currentUser.id)
      : false;

    if (!isCaptain) {
      wrap.style.display = "none";
      return;
    }

    wrap.style.display = "flex";
    toggle.checked = !!team.is_looking;
    toggle.onchange = () => handleToggleMatchmaking(teamId, toggle.checked);
  } catch (err) {
    console.error("Init matchmaking toggle error:", err);
    wrap.style.display = "none";
  }
}

// ---------- Sending a challenge (with venue/date/time) ----------

let currentChallenge = { receiverTeamId: null, senderTeamId: null };

// senderTeamId should be the id of the team the logged-in captain is challenging FROM.
// If a captain has only one team, pass it in directly; if they can captain multiple
// teams, the #challengeSenderTeam select is auto-populated below from the captain's
// own teams, filtered to the sport being challenged.
function openChallengeModal(receiverTeamId, receiverTeamName, sportId, senderTeamId) {
  currentChallenge.receiverTeamId = receiverTeamId;
  currentChallenge.senderTeamId = senderTeamId || null;

  const modal = document.getElementById("challengeModal");
  const nameEl = document.getElementById("challengeOpponentName");
  const alertEl = document.getElementById("challengeAlert");
  if (!modal) return;

  if (nameEl) nameEl.textContent = receiverTeamName;
  hideAlert(alertEl);
  document.getElementById("challengeForm").reset();
  populateSenderTeamSelect(sportId);
  modal.style.display = "flex";
}

// Fetches the captain's own teams and fills #challengeSenderTeam with only the
// ones that play the same sport as the team being challenged.
async function populateSenderTeamSelect(sportId) {
  const select = document.getElementById("challengeSenderTeam");
  if (!select) return;

  select.innerHTML = `<option value="">Loading your teams...</option>`;
  select.disabled = true;

  try {
    const res = await fetch(API_ENDPOINTS.myTeams, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    const result = await parseJsonSafe(res);

    if (!res.ok) {
      select.innerHTML = `<option value="">Couldn't load your teams</option>`;
      return;
    }

    const allTeams = result.data || [];
    const eligible = sportId
      ? allTeams.filter(t => Number(t.sport_id) === Number(sportId))
      : allTeams;

    // Temporary diagnostic — remove once confirmed working. If eligible teams
    // still comes up empty despite having a matching team, open the browser
    // console and check what this prints (field names may differ from
    // team_id/team_name/sport_id if /teams/mine shapes its response differently).
    console.log("populateSenderTeamSelect debug:", { sportId, allTeams, eligible });

    if (eligible.length === 0) {
      select.innerHTML = `<option value="">You have no team in this sport</option>`;
      return;
    }

    select.innerHTML = eligible.map(t => {
      const id = t.team_id ?? t.id;
      const name = t.team_name ?? t.name ?? "Unnamed team";
      return `<option value="${id}">${name}</option>`;
    }).join("");

    // Single eligible team: preselect it and keep currentChallenge.senderTeamId in sync.
    if (eligible.length === 1) {
      currentChallenge.senderTeamId = eligible[0].team_id ?? eligible[0].id;
    }
  } catch (err) {
    console.error("Load my teams for challenge error:", err);
    select.innerHTML = `<option value="">Couldn't reach the Versuz server</option>`;
  } finally {
    select.disabled = false;
  }
}

function closeChallengeModal() {
  const modal = document.getElementById("challengeModal");
  if (modal) modal.style.display = "none";
}

async function handleSendChallenge(event) {
  event.preventDefault();
  const alertEl = document.getElementById("challengeAlert");
  const btn = document.getElementById("challengeSendBtn");
  hideAlert(alertEl);

  const date = document.getElementById("challengeDate").value;
  const time = document.getElementById("challengeTime").value;
  const venue = document.getElementById("challengeVenue").value.trim();

  const senderSelect = document.getElementById("challengeSenderTeam");
  const senderTeamId = senderSelect ? parseInt(senderSelect.value, 10) : currentChallenge.senderTeamId;

  if (!date || !time || !venue) {
    showAlert(alertEl, "Please provide a date, time, and venue.");
    return;
  }
  if (!Number.isInteger(senderTeamId)) {
    showAlert(alertEl, "Select which of your teams is issuing this challenge.");
    return;
  }

  setLoading(btn, true);
  try {
    const res = await fetch(API_ENDPOINTS.sendChallenge, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`
      },
      body: JSON.stringify({
        sender_team_id: senderTeamId,
        receiver_team_id: currentChallenge.receiverTeamId,
        proposed_date: date,
        proposed_time: time,
        venue
      }),
    });
    const data = await parseJsonSafe(res);

    if (!res.ok) {
      showAlert(alertEl, (data && data.message) || "Couldn't send the challenge.");
      return;
    }

    showAlert(alertEl, "Challenge sent!", "success");
    setTimeout(() => {
      closeChallengeModal();
      if (typeof loadPendingChallenges === "function") loadPendingChallenges();
    }, 900);
  } catch {
    showAlert(alertEl, "Couldn't reach the Versuz server.");
  } finally {
    setLoading(btn, false);
  }
}

// ---------- Pending challenges inbox (incoming + outgoing) ----------

async function loadPendingChallenges() {
  const incomingEl = document.getElementById("incomingChallengesList");
  const outgoingEl = document.getElementById("outgoingChallengesList");
  if (!incomingEl && !outgoingEl) return;

  try {
    const res = await fetch(API_ENDPOINTS.pendingChallenges, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    const result = await parseJsonSafe(res);

    if (!res.ok) {
      if (incomingEl) incomingEl.innerHTML = `<p style="color:var(--text-mute);font-size:.85rem;">Couldn't load challenges.</p>`;
      return;
    }

    const { incoming, outgoing } = result.data;

    if (incomingEl) {
      incomingEl.innerHTML = incoming.length > 0
        ? incoming.map(c => `
          <div class="list-row">
            <div>
              <div style="font-weight:700;">${c.sender_team_name} challenged ${c.receiver_team_name}</div>
              <div class="mono" style="font-size:.72rem;color:var(--text-mute);">
                ${c.sport_name} · ${formatChallengeDateTime(c.proposed_date, c.proposed_time)} · 📍 ${c.venue}
              </div>
            </div>
            <div class="flex gap-8">
              <button class="btn btn-primary btn-sm" onclick="handleRespondChallenge(${c.request_id}, 'Accepted')">Accept</button>
              <button class="btn btn-ghost btn-sm" onclick="handleRespondChallenge(${c.request_id}, 'Rejected')">Reject</button>
            </div>
          </div>
        `).join("")
        : `<p style="color:var(--text-mute);font-size:.85rem;">No incoming challenges.</p>`;
    }

    if (outgoingEl) {
      outgoingEl.innerHTML = outgoing.length > 0
        ? outgoing.map(c => `
          <div class="list-row">
            <div>
              <div style="font-weight:700;">Waiting on ${c.receiver_team_name}</div>
              <div class="mono" style="font-size:.72rem;color:var(--text-mute);">
                ${c.sport_name} · ${formatChallengeDateTime(c.proposed_date, c.proposed_time)} · 📍 ${c.venue}
              </div>
            </div>
            <span class="tag">Pending</span>
          </div>
        `).join("")
        : `<p style="color:var(--text-mute);font-size:.85rem;">No outgoing challenges.</p>`;
    }

  } catch (err) {
    console.error("Load pending challenges error:", err);
    if (incomingEl) incomingEl.innerHTML = `<p style="color:var(--text-mute);font-size:.85rem;">Couldn't reach the Versuz server.</p>`;
  }
}

async function handleRespondChallenge(requestId, action) {
  try {
    const res = await fetch(API_ENDPOINTS.respondChallenge, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`
      },
      body: JSON.stringify({ request_id: requestId, action }),
    });
    const data = await parseJsonSafe(res);

    if (!res.ok) {
      alert((data && data.message) || "Couldn't process that challenge.");
      return;
    }

    loadPendingChallenges();
    if (action === "Accepted" && typeof loadDashboard === "function") {
      loadDashboard();
    }
  } catch {
    alert("Couldn't reach the Versuz server.");
  }
}