FROM node:20

WORKDIR /usr/src/app

COPY package*.json ./

# Install dependencies
RUN npm install

# Install nodemon globally for hot-reloading
RUN npm install -g nodemon

COPY . .

EXPOSE 3000

# Start server using nodemon to watch for changes
CMD ["nodemon", "server.js"]
