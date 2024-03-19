const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const { join } = require('path');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const PORT = 3000;
const FILE_NAME = 'data.json';
const JWT_SECRET = 'your-secret-key'; // Change this to a secure secret key




// Allow requests from your front-end domain
app.use(cors({
    //origin: 'http://127.0.0.1:3000',
     origin: 'https://password-manager-9868.onrender.com',
    optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
}));



app.use(bodyParser.json());
app.use(express.static(join(__dirname, 'public')));

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
        credentials: [],
    };

    data.push(newUser);
    saveDataToFile(data);

    res.status(201).send('User registered successfully.');
});

// Login and issue JWT token
app.post('/login', (req, res) => {
    const data = readDataFromFile();
    const { username, password } = req.body;
    const user = data.find(user => user.username === username);

    if (user && bcrypt.compareSync(password, user.password)) {
        const token = jwt.sign({ userId: user.userId }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ message: 'Login successful.', token: token });
    } else {
        res.status(401).send('Invalid credentials.');
    }
});

app.get('/data', verifyToken, (req, res) => {
    const data = readDataFromFile();
    const userData = data.find(user => user.userId === req.user.userId);

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

// Verify JWT token middleware
function verifyToken(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) return res.status(403).send('A token is required for authentication');

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
    } catch (err) {
        return res.status(401).send('Invalid Token');
    }
    return next();
}

// Utility functions
function readDataFromFile() {
    try {
        const data = fs.readFileSync(FILE_NAME, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading the data file:', error);
        return [];
    }
}

function saveDataToFile(data) {
    try {
        fs.writeFileSync(FILE_NAME, JSON.stringify(data), 'utf8');
    } catch (error) {
        console.error('Error writing to the data file:', error);
    }
}

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
app.post('/user/delete-records', verifyToken, (req, res) => {
    const { records } = req.body;
    const userId = req.user.userId; // Assuming userId is included in the JWT payload
    const data = readDataFromFile();

    const user = data.find(u => u.userId === userId);
    if (!user) {
        return res.status(404).send('User not found.');
    }

    // Filter out records to keep
    user.credentials = user.credentials.filter((credential) => !records.includes(credential.service));
    console.log(user.credentials)

    saveDataToFile(data);

    res.json({ message: 'Records deleted successfully' });
});
app.post('/user/edit-credentials', verifyToken, (req, res) => {
    // console.log("lalallala")
    const { service, newService, newUsername, newPassword } = req.body;
    console.log(service, newService, newUsername, newPassword)

    const userId = req.user.userId; // Assuming userId is included in the JWT payload
    const data = readDataFromFile();

    const user = data.find(u => u.userId === userId);
    if (!user) {
        return res.status(404).send('User not found.');
    }

    const credentialIndex = user.credentials.findIndex(cred => cred.service === service);
    if (credentialIndex === -1) {
        return res.status(404).send('Credential not found.');
    }

    // Update the credential with new information provided
    if (newService) user.credentials[credentialIndex].service = newService;
    if (newUsername) user.credentials[credentialIndex].username = newUsername;
    if (newPassword) user.credentials[credentialIndex].password = newPassword;

    saveDataToFile(data);

    res.json({ message: 'Credential updated successfully.' });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
