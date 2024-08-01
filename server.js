if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config()
}
const express = require('express')
const path = require('path');
const expressLayouts = require('express-ejs-layouts')
const app = express()
const bcrypt = require('bcryptjs')
const passport = require('passport')
const flash = require('express-flash')
const session = require('express-session')
const initialize = require('./passport-config')
const { query } = require('./db'); // Import the database connection

initialize(passport);

app.set('view engine', 'ejs')
app.set('layout', './layouts/full-width')
app.use(express.urlencoded({ extended: false }))
app.use(expressLayouts)
app.use(express.static(path.join(__dirname, 'public')));


app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}))
app.use(passport.initialize())
app.use(passport.session())
app.use(flash())

// ** For static shopping cart ** //
app.use((req, res, next) => {
  if (!req.session.cart) {
    req.session.cart = [];
  }
  res.locals.cartItems = req.session.cart;
  res.locals.cartItemCount = req.session.cart.reduce((sum, item) => sum + item.quantity, 0);
  res.locals.cartTotal = req.session.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  // res.locals.user = req.user; // Make req.user available in views
  next();
});

// Constant Title
const title1 = 'Great Book Store'

// app.get('/randomPick', async (req, res) => {
//   try {
//     const result = await query('SELECT * FROM categories ORDER BY RANDOM() LIMIT 1');
//     res.render('CategoryTemplate.ejs', { category: result.rows })
//   } catch (error) {
//     console.error(error.message);
//     res.send("Error " + error);
//   }
// })

app.get('/test', (req, res) => {
  res.render('test.ejs');
}) 

// Route users
app.get('/users', async (req, res) => {
    try {
        const result = await query('SELECT * FROM users');
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

app.get('/', async (req, res) => {
  try {
    const result = await query('SELECT * FROM categories');
    res.render('index.ejs', { categories: result.rows, title: title1 ,message: req.flash('errororor')});
  } catch (err) {
    console.error(err);
    res.send("Error " + err);
  }
})

app.get('/category/:id', async (req, res) => { // problem with mystery shows thriller book
  const categoryId = req.params.id;
  try {
    const categoryResult = await query('SELECT category_name FROM categories WHERE category_id = $1', [categoryId]);
    const productsResult = await query('SELECT id, name, description, price FROM products WHERE category_id = $1', [categoryId]);
    res.render('CategoryTemplate.ejs', { title: title1, category: categoryResult.rows[0], products: productsResult.rows });
  } catch (err) {
    console.error(err);
    res.send('Error fetching category');
  }
})

app.get('/product/:id', async (req, res) => {
  const productId = req.params.id;
  try {
    const productResult = await query('SELECT * FROM products WHERE id = $1', [productId]);
    res.render('ProductTemplate.ejs', {title: title1, product: productResult.rows[0] });
  } catch (err) {
    console.error(err);
    res.send('Error retrieving product');
  }
});

app.post('/add-to-cart', (req, res) => {
  const { id, name, price, quantity } = req.body;
  const existingItemIndex = req.session.cart.findIndex(item => item.id === id); // -1 returned if condition not satisfied
  // console.log(id, name, price, quantity, existingItemIndex);
  
  // Conditional check to stop further processing if any field is missing
  if (!quantity) {
    res.status(400).send("Missing quantity");
    return; // Stop further processing
  }

  if (existingItemIndex > -1) {
    // If item already exists, update its quantity
    req.session.cart[existingItemIndex].quantity += parseInt(quantity, 10);
  } else {
    // Otherwise, add new item to the cart
    req.session.cart.push({ id, name, price: parseFloat(price), quantity: parseInt(quantity, 10) });
  }
  res.redirect('/cart'); // Redirect back to the product page or any desired page
})

app.get('/cart', (req, res) => {
  res.render('cart.ejs', {
    title: title1,
    cartItems: res.locals.cartItems,
    cartItemCount: res.locals.cartItemCount,
    cartTotal: res.locals.cartTotal
  });
})

// Route
app.get('/dashboard', checkNotAuthenticated, (req, res) => {
  res.render('Dashboard.ejs', {title: title1, user: req.user })
})

app.get('/admin-dashboard', checkNotAuthenticated, async (req, res) => {
  try {
    
    // const userRole = await query('SELECT role FROM users WHERE username = $1', [req.user]);
    if (req.user.role == 'admin') {
      console.log('test')
      try {
        const books = await query('select * from books');
        res.render('AdminDashboard.ejs', {title: title1, items: books.rows, user: req.user});
      } catch (err) {
        console.log(err);
      }
    } else {
        res.redirect('/')
    }
  } catch (err) {
    console.error(err);
  }
})

// Route
app.get('/login', checkAuthenticated, (req, res) => {
    res.render('login.ejs', {title: title1})
})

app.post('/login', passport.authenticate('local', {
    successRedirect: '/dashboard',
    failureRedirect: '/',
    failureFlash: true
}))

// Route
app.get('/register', checkAuthenticated, (req, res) => { // req = request , res = response
    res.render('register.ejs', {title: title1})
})

app.post('/register', async (req, res) => {
    let { name, username, email, password1, password2 } = req.body;
    let errors = [];
  
    if (!name || !username || !email || !password1 || !password2) {
      errors.push({ message: "Please enter all fields" });
    }
  
    if (password1.length < process.env.PASSWORD_LENGTH) {
      errors.push({ message: "Password must be a least " + process.env.PASSWORD_LENGTH + " characters long" });
    }
  
    if (password1 !== password2) {
      errors.push({ message: "Passwords do not match" });
    }
  
    if (errors.length > 0) { // If errors then need to restart form
      res.render('register.ejs', { errors, name, username, email, password1, password2 });
    } else { // Validation passed
      hashedPassword = await bcrypt.hash(password1, 10);
      query(
        `SELECT * FROM users WHERE email = $1`,
        [email],
        (err, results) => {
          // console.log("err1: " + err)
          if (err) {
            console.log(err);
          }
          // console.log(results.rows);
  
          if (results.rows.length > 0) {
            errors.push({message: 'Email already registered'})
            res.render("register.ejs", { title: title1, errors });
          } else {
            query(
              `INSERT INTO users (name, username, email, password)
                  VALUES ($1, $2, $3, $4)
                  RETURNING id, password`,
              [name, username, email, hashedPassword],
              (err, results) => {
                console.log("err2: " + err)
                if (err) {
                  throw err;
                }
                // console.log(results.rows);
                req.flash('success_msg', 'You are now registered. Please log in');
                res.redirect("/login");
              }
            );
          }
        }
      );
    }
});

app.get('/logout', (req, res) => {
  req.logout();
  res.render('index.ejs', { title: title1, message: "You have logged out successfully" });
});
app.post('/logout', (req, res) => {
  req.logout((err) => {
      if (err) {
          console.error('Logout error:', err);
          return res.redirect('/');
      }
      res.redirect('/login');
  });
});

  function checkAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
      return res.redirect('/dashboard');
    }
    next();
  }

  function checkNotAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
      return next();
    }
    req.flash('error_msg','Must be logged in.')
    res.redirect('/login');
  }

  app.listen(3000, () => {
    console.log('Server started on http://localhost:3000');
});