document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const errorDiv = document.getElementById('error-message');
    errorDiv.classList.add('d-none');

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        if (!res.ok) throw new Error('Identifiants incorrects');

        const data = await res.json();

        // Stocker le token et les infos utilisateur
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));

        // Rediriger vers le dashboard
        window.location.href = 'dashboard.html';
    } catch (error) {
        errorDiv.textContent = error.message;
        errorDiv.classList.remove('d-none');
    }
});
