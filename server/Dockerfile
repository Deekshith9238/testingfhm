FROM node:18-alpine

WORKDIR /app

# Debug: List contents of current directory
RUN ls -la

# Copy package files first
COPY package.json package-lock.json* ./

# Debug: List contents after copying package files
RUN ls -la

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Debug: List contents after copying all files
RUN ls -la

# Build TypeScript
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"] 