FROM node:20-alpine

# Install pm2 globally
RUN npm install -g pm2

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm ci --only=production

# Bundle app source
COPY . .

# Expose port
EXPOSE 3000

# Start command
CMD ["pm2-runtime", "start", "ecosystem.config.js", "--env", "production"]
