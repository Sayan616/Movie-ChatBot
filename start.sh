#!/bin/bash

# Make ports public automatically
curl -s -X PATCH \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"visibility":"public"}' \
  "https://api.github.com/user/codespaces/$CODESPACE_NAME/ports/5000" > /dev/null

# Update .env with current codespace URL
echo "VITE_API_URL=https://${CODESPACE_NAME}-5000.app.github.dev" > /workspaces/Movie-ChatBot/movie-chatbot/.env

echo "✅ Port set to public"
echo "✅ API URL: https://${CODESPACE_NAME}-5000.app.github.dev"

# Start Flask
cd /workspaces/Movie-ChatBot
python app.py
