#!/bin/bash
# ============================================
# PartyPal — Local Setup Script
# Run this once after unzipping the project
# ============================================

echo "🎊 Setting up PartyPal..."
echo ""

# Check Node version
NODE_VERSION=$(node -v 2>/dev/null | cut -d'v' -f2 | cut -d'.' -f1)
if [ -z "$NODE_VERSION" ] || [ "$NODE_VERSION" -lt 18 ]; then
  echo "❌ Node.js 18+ required. Download at https://nodejs.org"
  exit 1
fi
echo "✅ Node.js $(node -v) detected"

# Install dependencies
echo "📦 Installing dependencies..."
npm install
echo "✅ Dependencies installed"

# Copy env file if .env.local doesn't exist
if [ ! -f ".env.local" ]; then
  cp .env.example .env.local
  echo ""
  echo "⚠️  ACTION REQUIRED:"
  echo "   Open .env.local and replace ANTHROPIC_API_KEY with your real key"
  echo "   Get your key at: https://console.anthropic.com/settings/keys"
  echo ""
else
  echo "✅ .env.local already exists"
fi

echo ""
echo "🚀 To start PartyPal locally, run:"
echo "   npm run dev"
echo ""
echo "Then open: http://localhost:3000"
echo ""
echo "🌐 When ready to deploy to Vercel:"
echo "   1. Push this folder to GitHub"
echo "   2. Go to vercel.com → New Project → Import from GitHub"
echo "   3. Add ANTHROPIC_API_KEY in Vercel's Environment Variables"
echo "   4. Deploy — done!"
