//Install Command:
//npm init -y
//npm i express express-handlebars body-parser mongodb

//Before going into code:
// - Be sure to start the database before use.
//#sudo systemcl start mongodb
//#sudo system status mongodb
// - Open Mongo Compass to view the database
const { MongoClient, ObjectId } = require('mongodb');

const express = require('express');
const server = express();

const bodyParser = require('body-parser');
server.use(express.json()); 
server.use(express.urlencoded({ extended: true }));

const handlebars = require('express-handlebars');
server.set('view engine', 'hbs');
server.engine('hbs', handlebars.engine({
    extname: 'hbs',
}));

server.use(express.static('public'));

//Require a MongoDB connection. This will create a client
//to connect to the specified mongoDB. The last part of the
//URL is the database it connects to.

// const { MongoClient } = require('mongodb');
const databaseURL = "mongodb://127.0.0.1:27017/";
const mongoClient = new MongoClient(databaseURL);

const databaseName = "logindb"; //name of the login database
const collectionName = "login";
const postsCollectionName = "posts"; 
const commentsCollectionName = "comments";

//To interact with the mongo database, a client needs to be made
//and then the client should connect to the database.
async function initialConntection(){
    let con = await mongoClient.connect();
    console.log("Attempt to create!");
    const dbo = mongoClient.db(databaseName);
    //Will create a collection if it has not yet been made
    dbo.createCollection(collectionName);
    dbo.createCollection(postsCollectionName);
    dbo.createCollection(commentsCollectionName);
  }
initialConntection();

const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/logindb');

const postSchema = new mongoose.Schema({
    title: { type: String },
    image: { type: String }
},{ versionKey: false });
  
const postModel = mongoose.model('post', postSchema);

const profileSchema = new mongoose.Schema({
    image: { type: String },
    name: { type: String },
    bio: { type: String }
},{ versionKey: false });
  
const profileModel = mongoose.model('profile', profileSchema);

const commentSchema = new mongoose.Schema({
    title: { type: String },
    comment: { type: String }
},{ versionKey: false });
  
const commentModel = mongoose.model('comment', commentSchema);

//If there are no initial functions to be called, just call the
//connect function.
//mongoClient.connect();

let currentUser = ''; //will be used for the knowing which user is logged in

server.get('/', function(req, resp){
  resp.render('login-page',{
    layout: 'loginindex',
    title: 'Login Page'
  });
});

//This is the login function. It uses the logindb database and compares it to the input.
server.post('/read-user', async function(req, resp) {
  const dbo = mongoClient.db(databaseName);
  const loginCollection = dbo.collection(collectionName);
  const commentsCollection = dbo.collection(commentsCollectionName);
  const col = dbo.collection(postsCollectionName);
  const posts = await col.find({deleted: false}).toArray();

  // A search query will come in the form of a JSON array as well. Make
  // sure that it follows the correct syntax.
  const searchQuery = { user: req.body.user, pass: req.body.pass };
  
  let user = await loginCollection.findOne(searchQuery);
  
  console.log('Finding user');
  console.log('Inside: ' + JSON.stringify(user));

  if (user != null) {  // If login credentials are correct, it will go to the main page, FOR NOW THOUGH, it will go to the view post page.
      let commentsCursor = commentsCollection.find({deleted: false});
      let comments = await commentsCursor.toArray();

      currentUser = req.body.user;

      resp.render('MainPage', {
        layout: 'MainPageindex',
        title: 'Main Page',
        posts: posts, // Pass fetched posts to the template
        username: currentUser 
    });

  } else {  // If login credentials are incorrect, it will go to the login page
      resp.render('login-page', {
          layout: 'loginindex',
          title: 'Login Page'
      });
  }
});

server.get('/main', async (req, res) => {
  try {
      const dbo = mongoClient.db(databaseName);
      const col = dbo.collection(postsCollectionName);

      // Fetch all posts where deleted is false
      const posts = await col.find({deleted: false}).toArray();

      // Render the MainPage.hbs template with posts data
      res.render('MainPage', {
          layout: 'MainPageindex',
          title: 'Main Page',
          posts: posts // Pass fetched posts to the template
      });
  } catch (error) {
      console.error('Error fetching posts:', error);
      res.status(500).send('Error fetching posts');
  }
});

server.get('/addPostPage', (req, res) => {
  res.render('addpostpage', {
      layout: 'post-layout-index',
      title: 'Add Post Page',
  });
});

server.post('/addPost', async (req, res) => {
  const dbo = mongoClient.db(databaseName);
  const col = dbo.collection(postsCollectionName);

  const newPost = {
      _id: new ObjectId(), // Generate a new unique ObjectId for each post
      username: currentUser, // Replace with actual current user
      time: new Date().toLocaleString(),
      title: req.body.title,
      tag: req.body.community,
      description: req.body.body, 
      deleted : false // Set deleted to false by default 
  };

  try {
      await col.insertOne(newPost);
      res.redirect('/main'); // Redirect back to the main page after adding the post
  } catch (error) {
      console.error('Error adding post:', error);
      res.status(500).send('Error adding post');
  }
});

server.get('/view-post/view/:postId', async (req, resp) => {
  const dbo = mongoClient.db(databaseName);
  const col = dbo.collection(postsCollectionName);
  const postId = req.params.postId;

  //Fetch all comments from the comments collection
  const commentsCollection = dbo.collection(commentsCollectionName);

  let commentsCursor = commentsCollection.find({ postNum: postId });
  let comments = await commentsCursor.toArray();
    // Fetch the specific post by its ID
    const post = await col.findOne({ _id: new ObjectId(postId) });


    resp.render('view-post-page', {
      layout: 'viewpostindex',
      title: 'View Post',
      post: post,
      comments: comments,
      username: req.body.username
    });

    //console.log('Comments: ' + JSON.stringify(post));
});

server.post('/create-comment/:postId', async function(req, resp) {
  const dbo = mongoClient.db(databaseName);
  const col = dbo.collection(commentsCollectionName);
  const col1 = dbo.collection(postsCollectionName);
  const postId = req.params.postId;

  // Get the comment and username from the request body
  const comment = {
      text: req.body.comment,
      username: currentUser,
      postNum: req.params.postId,
      createdAt: new Date().toLocaleString()
  };

  //Insert the comment into the collection
  await col.insertOne(comment);
  console.log('Comment added: ' + JSON.stringify(comment));

  // Fetch updated comments
  let commentsCursor = col.find({ postNum: postId }); // Filter by postId
  let comments = await commentsCursor.toArray();

  // Fetch all posts from the 'posts' collection
  const post = await col1.findOne({ _id: new ObjectId(postId) });
  
  resp.render('view-post-page', {
    layout: 'viewpostindex',
    title: 'View Post',
    post: post,
    comments: comments,
    username: req.body.username
  });
  
});

// delete 

//needs revision for view post 
server.get('/view-post/delete/:postId', async (req, res) => {
  try {
    
      const dbo = mongoClient.db(databaseName);
      const col = dbo.collection(postsCollectionName);
      const postId = req.params.postId;
      // Find the post by ID
      const post = await col.findOne({ _id: new ObjectId(postId) });

      if (!post) {
          return res.status(404).send('Post not found');
      }

      // Check if the post's username matches the current user
      if (post.username !== currentUser) {
          return res.status(403).send('You do not have permission to delete this post');
      }

      // Mark the post as deleted
      const result = await col.updateOne(
          { _id: new ObjectId(postId) },
          { $set: { deleted: true } } // Set 'deleted' field to true
      );

      if (result.modifiedCount === 1) {
          res.status(200).send('Post marked as deleted');
      } else {
          res.status(500).send('Failed to mark post as deleted');
      }
  } catch (error) {
      console.error('Error marking post as deleted:', error);
      res.status(500).send('Internal server error');
  }
});

server.get('/posts/delete/:postId', async (req, res) => {

  try {
      const dbo = mongoClient.db(databaseName);
      const col = dbo.collection(postsCollectionName);
      const postId = req.params.postId; // Extract currentUser from the query parameters
      // Find the post by ID
      const post = await col.findOne({ _id: new ObjectId(postId) });

      if (!post) {
          return res.status(404).send('Post not found');
      }

      // Check if the post's username matches the current user
      if (post.username !== currentUser) {
          return res.status(403).send('You do not have permission to delete this post');
      }

      // Mark the post as deleted
      const result = await col.updateOne(
          { _id: new ObjectId(postId) },
          { $set: { deleted: true } }
      );

      if (result.modifiedCount === 1) {
          res.status(200).send('Post marked as deleted');
      } else {
          res.status(500).send('Failed to mark post as deleted');
      }
  } catch (error) {
      console.error('Error marking post as deleted:', error);
      res.status(500).send('Internal server error');
  }
});

server.get('/viewUserProfile', async function(req, resp){
  let post_data = await postModel.find({}).lean();
  let profile_data = await profileModel.find({}).lean();
  let comment_data = await commentModel.find({}).lean();
  resp.render('viewUser_post',{
      layout: 'index2',
      title: 'User Profile',
      post_data: post_data,
      profile_data: profile_data,
      comment_data: comment_data
  });
});

server.get('/viewUser_Com', async function(req, resp){
  let post_data = await postModel.find({}).lean();
  let profile_data = await profileModel.find({}).lean();
  let comment_data = await commentModel.find({}).lean();
  resp.render('viewUser_com',{
      layout: 'index',
      title: 'User Profile',
      post_data: post_data,
      profile_data: profile_data,
      comment_data: comment_data
  });
});

server.get('/viewUser_Post', async function(req, resp){
  let post_data = await postModel.find({}).lean();
  let profile_data = await profileModel.find({}).lean();
  let comment_data = await commentModel.find({}).lean();
  resp.render('viewUser_post',{
      layout: 'index2',
      title: 'User Profile',
      post_data: post_data,
      profile_data: profile_data,
      comment_data: comment_data
  });
});

server.get('/edit_profile', function(req, resp){
  resp.render('editProfile',{
      layout: 'index5',
      title: 'Edit User Profile'
  });
});

server.get('/edit_comments', function(req, resp){
  resp.render('editComment',{
      layout: 'index3',
      title: 'Edit Comment'
  });
});

server.get('/reply', function(req, resp){
  resp.render('reply',{
      layout: 'index3',
      title: 'Reply'
  });
});

server.get('/edit_posts', function(req, resp){
  resp.render('editPost',{
      layout: 'index4',
      title: 'Edit Post'
  });
});

//Only at the very end should the database be closed.
function finalClose(){
  console.log('Close connection at the end!');
  mongoClient.close();
  process.exit();
}

process.on('SIGTERM',finalClose);  //general termination signal
process.on('SIGINT',finalClose);   //catches when ctrl + c is used
process.on('SIGQUIT', finalClose); //catches other termination commands

const port = process.env.PORT | 3000;
server.listen(port, function(){
  console.log('Listening at port '+port);
});