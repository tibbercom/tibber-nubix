FROM node:6-slim

# Create app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# Install app dependencies

ADD package.json /usr/src/app/package.json
RUN npm install
COPY . /usr/src/app
RUN npm run build

# Bundle app source


EXPOSE 3000
CMD [ "npm", "run","prod"]