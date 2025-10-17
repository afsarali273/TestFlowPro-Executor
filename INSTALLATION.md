# 🚀 TestFlow Pro - Installation Guide

## Prerequisites

### Required Software
- **Node.js** 18.x or higher ([Download](https://nodejs.org/))
- **Git** ([Download](https://git-scm.com/download/win))
- **Python** 3.8+ ([Download](https://www.python.org/downloads/)) - Required for `odbc` package
- **Visual Studio Build Tools** (Windows) - Required for native modules

### System Requirements
- **OS**: Windows 10/11 (64-bit), macOS, or Linux
- **RAM**: 8GB minimum, 16GB recommended
- **Storage**: 2GB free space

### Windows-Specific Requirements
- **Visual Studio Build Tools 2019/2022** ([Download](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2019))
- **Windows SDK** (included with Build Tools)
- **MSVC v143 compiler toolset** (included with Build Tools)

## Package Dependencies

### Backend Dependencies (Root)
```json
{
  "@playwright/test": "^1.55.0",
  "playwright": "^1.55.0",
  "axios": "^1.10.0",
  "ajv": "^8.17.1",
  "@faker-js/faker": "^9.8.0",
  "mysql2": "^3.14.1",
  "odbc": "^2.4.9",
  "dotenv": "^16.5.0",
  "jsonpath-plus": "^10.3.0",
  "xml2js": "^0.6.2",
  "ts-node": "^10.9.2",
  "typescript": "^5.8.3"
}
```

### Frontend Dependencies (React UI)
```json
{
  "next": "15.2.4",
  "react": "^19",
  "react-dom": "^19",
  "@radix-ui/react-*": "Various UI components",
  "@monaco-editor/react": "^4.7.0",
  "tailwindcss": "^3.4.17",
  "lucide-react": "^0.454.0"
}
```

## Installation Steps

### 1. Install Prerequisites (Windows)
```cmd
# Install Python (required for odbc package)
# Download from https://www.python.org/downloads/
# Make sure to check "Add Python to PATH"

# Install Visual Studio Build Tools
# Download from https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2019
# Select "C++ build tools" workload
```

### 2. Clone Repository
```bash
git clone https://github.com/your-repo/TestFlowPro.git
cd TestFlowPro
```

### 3. Install Backend Dependencies
```bash
npm install
```

### 4. Install Playwright Browsers
```bash
npx playwright install
```

### 5. Install Frontend Dependencies
```bash
cd frontend/TestEditor
npm install --legacy-peer-deps
cd ../..
```

### 6. Setup Environment (Optional)
```bash
# Create .env file in root directory
echo "BASE_URL=https://your-api.com" > .env
echo "PARALLEL_THREADS=4" >> .env
```

## Running the Application

### Start Frontend UI
```bash
cd frontend/TestEditor
npm run dev
```
Access UI at: http://localhost:3000

### Run Tests via CLI
```bash
# Run all tests
npx ts-node src/runner.ts

# Run specific suite
npx ts-node src/runner.ts --file="./testSuites/example.json"

# Run by application
npx ts-node src/runner.ts --applicationName="MyApp"
```

## Verification

### Test Installation
```bash
# Check Node.js
node --version

# Check TypeScript
npx tsc --version

# Test Playwright
npx playwright --version

# Run sample test
npx ts-node src/runner.ts --file="./testSuites/sample.json"
```

## Troubleshooting

### Common Issues

**Node.js version error:**
```bash
# Update Node.js to 18.x or higher
```

**Playwright browser installation fails:**
```bash
# Manual browser install
npx playwright install chromium
```

**Python/Build tools error (Windows):**
```cmd
# Install Python 3.8+
# Install Visual Studio Build Tools
# Restart terminal and try again
npm install
```

**ODBC package installation fails:**
```bash
# Skip ODBC if not needed for database testing
npm install --ignore-scripts
```

**Frontend dependencies error:**
```bash
# Clear cache and reinstall
cd frontend/TestEditor
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

**Permission errors (Windows):**
```cmd
# Run as Administrator
```

**Native module compilation fails:**
```cmd
# Install windows-build-tools (deprecated but sometimes works)
npm install --global windows-build-tools

# Or use chocolatey
choco install python visualstudio2019buildtools
```

### Database Setup (Optional)

**MySQL:**
```env
DB_USERDB_TYPE=mysql
DB_USERDB_HOST=localhost
DB_USERDB_PORT=3306
DB_USERDB_USER=root
DB_USERDB_PASSWORD=password
DB_USERDB_NAME=testdb
```

## Quick Start

1. **Create your first test suite** using the UI at http://localhost:3000
2. **Import existing tests** from Postman, cURL, or Swagger
3. **Run tests** via CLI or UI
4. **View reports** in HTML format

## Support

- **Documentation**: See main README.md
- **Issues**: Create GitHub issue
- **Examples**: Check `/testSuites` folder

---

✅ **Installation Complete!** You're ready to start testing with TestFlow Pro.