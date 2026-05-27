FROM node:20

WORKDIR /usr/src/app

COPY package*.json ./

# Install dependencies including Angular CLI
RUN npm install
RUN npm install -g @angular/cli

COPY . .

EXPOSE 4200

# Bind to 0.0.0.0 so the app is accessible outside the container
CMD ["ng", "serve", "--host", "0.0.0.0"]
