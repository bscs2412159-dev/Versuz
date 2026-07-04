const API_URL = 'https://zany-funicular-779jwrwp74r4h447-5000.app.github.dev/api/v1';

const registerForm = document.getElementById('registerForm');
const loginForm = document.getElementById('loginForm');
const authSubtitle = document.getElementById('authSubtitle');
const switchToLogin = document.getElementById('switchToLogin');
const switchToRegister = document.getElementById('switchToRegister');

if (switchToLogin && switchToRegister) {
    switchToLogin.addEventListener('click', (e) => {
        e.preventDefault();
        registerForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
        authSubtitle.innerText = 'Verify Credentials';
    });

    switchToRegister.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
        authSubtitle.innerText = 'Claim Your Roster Spot';
    });
}

if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const full_name = document.getElementById('regName').value;
        const email = document.getElementById('regEmail').value;
        const password = document.getElementById('regPassword').value;

        try {
            const response = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ full_name, email, password })
            });
            const result = await response.json();

            if (result.status === 'success') {
                localStorage.setItem('versuz_token', result.token);
                alert('Account generated successfully! Redirecting to Arena dashboard...');
                window.location.href = 'dashboard.html';
            } else {
                alert(`Registration Refused: ${result.message}`);
            }
        } catch (err) {
            console.error(err);
            alert('Cannot bridge connection to API Server. Ensure VersuzAPI is running!');
        }
    });
}

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const result = await response.json();

            if (result.status === 'success') {
                localStorage.setItem('versuz_token', result.token);
                alert(result.message);
                window.location.href = 'dashboard.html';
            } else {
                alert(`Login Failed: ${result.message}`);
            }
        } catch (err) {
            console.error(err);
            alert('Cannot bridge connection to API Server.');
        }
    });
}

const token = localStorage.getItem('versuz_token');

if (window.location.pathname.includes('dashboard.html') && !token) {
    window.location.href = 'index.html';
}

async function loadDashboardData() {
    if (!window.location.pathname.includes('dashboard.html')) return;

    try {
        const response = await fetch(`${API_URL}/dashboard/arena`);
        const result = await response.json();

        if (result.status === 'success') {
            const queueContainer = document.getElementById('queueContainer');
            queueContainer.innerHTML = '';

            const activeTeams = result.data.active_matchmaking_pool;
            if (activeTeams.length === 0) {
                queueContainer.innerHTML = `
                    <div class="arena-card" style="text-align: center; color: var(--text-muted);">
                        No opposing teams looking for a match right now. Toggle your search status to be discovered!
                    </div>`;
                return;
            }

            activeTeams.forEach(team => {
                queueContainer.innerHTML += `
                    <div class="arena-card" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid var(--neon-pink);">
                        <div>
                            <strong style="font-size: 1.3rem;">${team.team_name}</strong>
                            <div style="font-size: 0.9rem; color: var(--text-muted);">Sport Category ID: ${team.sport_id}</div>
                        </div>
                        <button class="btn-neon" style="width: auto; padding: 8px 16px; font-size: 0.9rem;" onclick="issueDirectChallenge(${team.team_id})">Challenge</button>
                    </div>
                `;
            });
        }
    } catch (err) {
        console.error('Failed to resolve active pool render lifecycle:', err);
    }
}

const createTeamForm = document.getElementById('createTeamForm');
if (createTeamForm) {
    createTeamForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('teamName').value;
        const sport_id = document.getElementById('sportSelect').value;

        try {
            const response = await fetch(`${API_URL}/teams/create`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name, sport_id })
            });
            const result = await response.json();

            if (result.status === 'success') {
                alert('Club registered successfully!');
                document.getElementById('createTeamBox').classList.add('hidden');
                
                // Expose active roster layout components dynamically
                document.getElementById('activeTeamBox').classList.remove('hidden');
                document.getElementById('displayTeamName').innerText = result.data.name;
                document.getElementById('displaySport').innerText = sport_id === "4" ? "Padel" : "Sports Discipline " + sport_id;
                loadDashboardData();
            } else {
                alert(`Error creating team: ${result.message}`);
            }
        } catch (err) {
            console.error('Team creation runtime error:', err);
        }
    });
}

const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('versuz_token');
        window.location.href = 'index.html';
    });
}

if (window.location.pathname.includes('dashboard.html')) {
    loadDashboardData();
}