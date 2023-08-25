FROM node:latest

RUN apt-get update && apt-get install -y libgtk-3-0 libgbm-dev xvfb fluxbox openjdk-17-jdk
RUN npm install -g @vscode/vsce

WORKDIR /usr/src/qodana