const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { join } = require("path");

const app = express();
const PORT = 3000;
const FILE_NAME = 'data.json';

app.use(bodyParser.json());
app.use(express.static(join(__dirname, 'public')));
app.use(session({
    secret: 'your-secret-string',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Use true in production with HTTPS
}));

// Register a new user
app.post('/register', async (req, res) => {
    const data = readDataFromFile();
    const { username, password } = req.body;

    if (data.find(user => user.username === username)) {
        return res.status(400).send('Username already taken.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = {
        userId: data.length + 1, // Simple ID assignment; consider a more robust approach for production
        username,
        password: hashedPassword,
        credentials:[]
    };

    data.push(newUser);
    saveDataToFile(data);

    res.status(201).send('User registered successfully.');
});

// Login
app.post('/login', (req, res) => {
    const data = readDataFromFile();
    const { username, password } = req.body;

    const user = data.find(user => user.username === username);

    if (user && bcrypt.compareSync(password, user.password)) {
        req.session.userId = user.userId;
        res.send('Login successful.');
    } else {
        res.status(401).send('Invalid credentials.');
    }
});

// Get data for the logged-in user
app.get('/data', (req, res) => {
    if (!req.session.userId) {
        return res.status(403).send('User not authenticated');
    }

    const data = readDataFromFile();
    const userData = data.find(user => user.userId === req.session.userId);

    if (userData) {
        res.json(userData);
    } else {
        res.status(404).send('User data not found');
    }
});

// Password strength checker endpoint
app.post('/password/strength', (req, res) => {
    const password = req.body.password;
    const result = checkPasswordStrength(password);
    res.json(result);
});

function checkPasswordStrength(password) {
    let score = 0;
    if (password.length < 6) {
        return { strength: 'Weak', score };
    }

    // Add points for length, presence of digits, special characters, and uppercase letters
    if (password.length >= 8) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    return {
        strength: score < 2 ? 'Weak' : score < 4 ? 'Moderate' : 'Strong',
        score
    };
}

// Utility functions
function readDataFromFile() {
    try {
        const data = fs.readFileSync(FILE_NAME, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error("Error reading the data file:", error);
        return [];
    }
}

function saveDataToFile(data) {
    try {
        fs.writeFileSync(FILE_NAME, JSON.stringify(data), 'utf8');
    } catch (error) {
        console.error("Error writing to the data file:", error);
    }
}

app.post('/user/:userId/credentials', (req, res) => {
    const { userId } = req.params;
    const { service, username, password } = req.body;
    const data = readDataFromFile();
    const user = data.find(u => u.userId.toString() === userId);

    if (!user) {
        return res.status(404).send('User not found.');
    }

    const newCredential = { service, username, password };
    user.credentials.push(newCredential);
    saveDataToFile(data);

    res.status(201).send('Credential added successfully.');
});
app.get('/user/:userId/credentials', (req, res) => {
    const { userId } = req.params;
    const data = readDataFromFile();
    const user = data.find(u => u.userId.toString() === userId);

    if (!user) {
        return res.status(404).send('User not found.');
    }

    res.json(user.credentials);
});

// Mock JWT verification middleware
function verifyToken(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1]; // Get token from header
    if (!token) return res.status(403).send('A token is required for authentication');

    try {
        const decoded = jwt.verify(token, 'your-secret-key'); // Replace 'your-secret-key' with your actual secret key
        req.user = decoded; // Assuming JWT payload includes userId
    } catch (err) {
        return res.status(401).send('Invalid Token');
    }
    return next();
}
// Add credentials endpoint
app.post('/user/credentials', verifyToken, (req, res) => {
    const { service, username, password } = req.body;
    const userId = req.user.userId; // Assuming userId is included in the JWT payload
    const data = readDataFromFile();

    const user = data.find(u => u.userId === userId);
    if (!user) {
        return res.status(404).send('User not found.');
    }

    const newCredential = { service, username, password };
    user.credentials.push(newCredential);
    saveDataToFile(data);

    res.status(201).send('Credential added successfully.');
});
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});