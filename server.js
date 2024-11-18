const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
//for otp
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { sql, connectToDatabase } = require('./dbConfig'); // Import dbConfig file
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Serve static files from the "Home Page" directory
app.use(express.static(path.join(__dirname, 'Home Page'))); // Serve all static assets in this folder
app.use('/Home%20Page/', express.static(path.join(__dirname, 'Home Page')));
app.use('/About%20Us/index.html', express.static(path.join(__dirname, 'About Us')));
app.use('/About%20Us/', express.static(path.join(__dirname, 'About Us')));

app.use('/Sign%20in/register.html/',express.static(path.join(__dirname, 'Sign in')));
app.use('/Log%20in/login.html/',express.static(path.join(__dirname, 'Log in')));

app.use('/Doctor%20Registration%20Page/doctors.html',express.static(path.join(__dirname, 'Doctor Registration Page')));

// Route to serve the registration page
app.get('/Sign%20in/register.html/', (req, res) => {
    res.sendFile(path.join(__dirname, 'Sign in', 'register.html'));
});

app.get('/Log%20in/login.html/', (req, res) => {
    res.sendFile(path.join(__dirname, 'Log in', 'login.html'));
});


app.get('/Doctor%20Registration%20Page/doctors.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'Doctor Registration Page', 'doctors.html'));
});


// Function to generate OTP
function generateOTP() {
    return crypto.randomInt(100000, 999999).toString(); // Generates a 6-digit OTP
}


// Function to send OTP via email
async function sendOTPEmail(email, otp) {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'serviceg2002@gmail.com',
            pass: 'xfuemysjuglpgkso'
        },
        tls: {
            rejectUnauthorized: false, // Add this to ignore self-signed certificate errors
          },
    });

    const mailOptions = {
        from: 'serviceg2002@gmail.com',
        to: email,
        subject: 'OTP for Doctor Registration',
        text: `Your OTP for registration is: ${otp}`
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('OTP sent to email:', email);
    } catch (error) {
        console.error('Error sending OTP email:', error);
    }
}




// Route to handle doctor registration Sign in.

app.post('/register', async (req, res) => {
    const { name, surname, specialty, hospital, country, profilePic, password,email,phone } = req.body;

    try {
         // Generate OTP
         const otp = generateOTP();
         const expiryTime = new Date(Date.now() + 5 * 60000); // OTP expires in 1 minutes
 


        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10); // 10 is the salt rounds, you can adjust it

         // Insert OTP into the database
         await sql.query`
         INSERT INTO DoctorOTP (Email, OTP, ExpiryTime) 
         VALUES (${email}, ${otp}, ${expiryTime})
     `;

      // Send OTP email to the doctor's email
      await sendOTPEmail(email, otp);

        // Insert doctor details into the database with hashed password
        await sql.query`INSERT INTO Doctors (name, surname, specialty, hospital, country, profilePic, password, email, phone)
                        VALUES (${name}, ${surname}, ${specialty}, ${hospital}, ${country}, ${profilePic}, ${hashedPassword}, ${email}, ${phone})`;

        res.status(200).send('Doctor registeration initiated. OTP sent to email.');
    } catch (error) {
        console.error('Error registering doctor:', error);
        res.status(500).send('Error registering doctor.');
    }
});




// Route to verify OTP and complete registration
app.post('/verify-otp', async (req, res) => {
    const { email, otp, password, name, surname, specialty, hospital, country, profilePic, phone } = req.body;

    try {
        // Retrieve the OTP from the database
        const result = await sql.query`
            SELECT OTP, ExpiryTime FROM DoctorOTP WHERE Email = ${email}
        `;

        if (result.recordset.length > 0) {
            const { OTP: storedOTP, ExpiryTime } = result.recordset[0];

            // Check if OTP matches and is not expired
            if (otp === storedOTP && new Date() < new Date(ExpiryTime)) {
                
                // Hash the password
                const hashedPassword = await bcrypt.hash(password, 10);

                 // Insert doctor details into the Doctors table
                 await sql.query`
                 INSERT INTO Doctors (Name, Surname, Specialty, Hospital, Country, ProfilePic, Password, Email, Phone)
                 VALUES (${name}, ${surname}, ${specialty}, ${hospital}, ${country}, ${profilePic}, ${hashedPassword}, ${email}, ${phone})
             `;

              // Optionally, you can remove the OTP from the database after successful verification
              await sql.query`
              DELETE FROM DoctorOTP WHERE Email = ${email}
          `;
            // OTP is valid, complete registration
             res.status(200).send('Registration successful!');

               
            } else {
                res.status(400).send('Invalid or expired OTP.');
            }
        } else {
            res.status(400).send('No OTP found for this email.');
        }
    } catch (error) {
        console.error('Error verifying OTP:', error);
        res.status(500).send('Error verifying OTP.');
    }
});




// Route to handle doctor login
app.post('/login', async (req, res) => {
    const { name, surname, password } = req.body;

    // Log request body to verify that all fields are received
    console.log("Received login data:", req.body);

    try {
        console.log('Connected to the database');
        
        // Check if password is undefined and handle the case
        if (!password) {
            console.error('Password is undefined or empty.');
            return res.status(400).send('Password is required.');
        }

        // Retrieve doctor details from the database
        const result = await sql.query`
            SELECT * FROM Doctors WHERE Name = ${name} AND Surname = ${surname}
        `;
        
        console.log('Query result:', result.recordset); // Log the result

        if (result.recordset.length > 0) {
            // Retrieve the stored hashed password
            const storedHashedPassword = result.recordset[0].Password;

            // Check if the stored hashed password exists
            if (!storedHashedPassword) {
                console.error("Stored hashed password is undefined.");
                return res.status(500).send('Server error: invalid stored password.');
            }

            // Compare the provided password with the stored hashed password
            const isMatch = await bcrypt.compare(password, storedHashedPassword);

            if (isMatch) {
                // If the passwords match, send doctor details
                res.status(200).json(result.recordset[0]);
            } else {
                // If passwords don't match, send invalid credentials response
                console.error('Password does not match.');
                res.status(401).send('Invalid credentials');
            }
        } else {
            // If no doctor is found with the given name and surname
            console.error('Doctor not found with provided name and surname.');
            res.status(401).send('Invalid credentials');
        }
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).send('Database error');
    }
});


// Route to get all registered doctors
app.get('/doctors', async (req, res) => {
    const country = req.query.country; // Get country from query parameters
    try {
        const result = await sql.query`SELECT * FROM Doctors WHERE country = ${country}`;
        console.log('Doctors fetched for country:', country, result.recordset); // Log fetched doctors for debugging
        res.status(200).json(result.recordset);
    } catch (error) {
        console.error('Error fetching doctors:', error);
        res.status(500).send('Error fetching doctors.');
    }
});





// Route to update hospital name for logged-in doctor
app.put('/update-hospital', async (req, res) => {
    const { doctorId, newHospital } = req.body;

    console.log('Received update request for doctorId:', doctorId, 'with new hospital:', newHospital);

    try {
        // Update the hospital name for the doctor
        const result = await sql.query`
            UPDATE Doctors 
            SET Hospital = ${newHospital}
            WHERE DoctorID = ${doctorId}
        `;
        
        console.log('Update result:', result); // Log the result of the update

        if (result.rowsAffected[0] > 0) {
            res.status(200).send('Hospital name updated successfully.');
        } else {
            res.status(404).send('Doctor not found.');
        }
    } catch (error) {
        console.error('Error updating hospital:', error);
        res.status(500).send('Error updating hospital.');
    }
});




// Connect to the database on server start
connectToDatabase();

// Test database connection
app.get('/test-db', async (req, res) => {
    try {
        const result = await sql.query('SELECT 1 AS test'); // Simple query to test connection
        res.send('Database connection successful: ' + result.recordset[0].test);
    } catch (err) {
        console.error('Database connection error:', err);
        res.status(500).send('Database connection failed');
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
