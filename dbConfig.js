const sql = require('mssql');


const config = {
    server: 'DESKTOP-95NGQ89',
    port: 1433,
    database: 'HealthcareDB',
    options: {
        encrypt: false, // Set to true for Azure or production
        trustServerCertificate: true,
        enableArithAbort: true,
    },
    // SQL Server Authentication
    user: 'Kevork',
    password: 'aroushian',
};


// Create a function to connect to the database
async function connectToDatabase() {
    try {
        await sql.connect(config);
        console.log('Connected to SQL Server');
    } catch (err) {
        console.error('Database connection failed: ', err);
    }
}

// Call connectToDatabase() only when the server starts
module.exports = {
    sql,
    connectToDatabase
};
