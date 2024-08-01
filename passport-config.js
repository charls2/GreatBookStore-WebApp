const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const { query } = require('./db'); // Import the database connection

function initialize(passport) {
    console.log("Passport Initialized");

    const authenticateUser = (email, password, done) => {
        query(
            `SELECT * FROM users WHERE email = $1`,
            [email],
            (err, results) => {
                if (err) {
                    throw err;
                }
                // console.log('RESULTS.ROWS: ', results.rows);

                if (results.rows.length > 0) { // Is a user with that email
                    const user = results.rows[0];
                    // console.log('There is a USER: ' + user + ' with email' + user.email);
                    bcrypt.compare(password, user.password, (err, isMatch) => {
                        if (err) {
                            console.log(err);
                        }
                        if (isMatch) {
                            // Password matched
                            return done(null, user);
                        } else {
                            // Password is incorrect
                            return done(null, false, { message: "Password is incorrect" });
                        }
                    });
                } else {
                    // No user
                    return done(null, false, { message: "No user with that email address" });
                }
            }
        );
    };

    passport.use(new LocalStrategy({ usernameField: 'email', passwordField: 'password' }, authenticateUser));

    passport.serializeUser((user, done) => done(null, user.id));

    passport.deserializeUser((id, done) => {
        query(`SELECT * FROM users WHERE id = $1`, [id], (err, results) => {
            if (err) {
                return done(err);
            }
            // console.log(`ID is ${results.rows[0].id}`);
            return done(null, results.rows[0]);
        });
    });
}

module.exports = initialize;
