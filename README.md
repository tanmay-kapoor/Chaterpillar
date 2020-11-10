# Chaterpillar

A simple chat application with socket.io and mongoDB

npm install to install all dependencies

Need to set env variables in a .env file:

1. MONGODB_URI : will use specified mongodb uri for connection.. default = mongodb://localhost:27017/chatDB

2. SESSION_SECRET : key for express session

3. SENDGRID_API_KEY : sendgrid api key

4. SENDER_EMAIL : email id that send the email.. created on your sendgrid account
