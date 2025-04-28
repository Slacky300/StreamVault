# Stage 1: Build the application
FROM node:18-alpine As builder

# Set the working directory inside the builder container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./


# Install dependencies
RUN npm install

# Copy the rest of the application code to the working directory
COPY . .
# Build the app
RUN npm run build

# Stage 2: Create the final image
FROM node:18-alpine

# Set the working directory inside the final container
WORKDIR /usr/src/app

# Copy only the built files from the builder stage
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/.env ./


ENV NODE_ENV=production
ENV PORT=3000
ENV REDIS_HOST=redis
ENV REDIS_PORT=6379
ENV WORKER_CONCURRENCY=2 
RUN npm install --only=production

# Specify the command to run your app using CMD which defines your runtime
CMD ["npm", "start"]

# Expose the port the app runs on
EXPOSE $PORT
