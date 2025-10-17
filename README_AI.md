# 🤖 AI-Powered Test Suite Generation with LangChain RAG

TestFlow Pro now includes AI capabilities using LangChain with RAG (Retrieval-Augmented Generation) to automatically generate test suites from various inputs using local Ollama models.

## 🚀 Features

- **Chat Interface**: Interactive AI chat for test suite generation
- **Multiple Input Types**: Support for API details, cURL commands, Swagger files, and UI test steps
- **Local AI Model**: Uses Ollama for privacy and offline capability
- **LangChain RAG**: Retrieval-Augmented Generation with vector embeddings
- **Knowledge Base**: Learns from existing test suites and framework documentation
- **Context-Aware**: Uses similar examples for better generation
- **JSON Output**: Generates test suites compatible with TestFlow Pro format

## 📋 Prerequisites

### 1. Install Ollama
```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.ai/install.sh | sh

# Windows
# Download from https://ollama.ai/download
```

### 2. Pull AI Model
```bash
# Recommended model (8B parameters)
ollama pull llama3.1:8b

# Alternative smaller model (3B parameters)
ollama pull llama3.2:3b

# Alternative larger model (70B parameters - requires more RAM)
ollama pull llama3.1:70b
```

### 3. Start Ollama Service
```bash
ollama serve
```

## 🎯 Usage

### 1. Access AI Chat
- Click the floating chat icon (💬) in the bottom-right corner of the TestFlow Pro UI
- The chat interface will open with multiple tabs for different input types

### 2. Input Types

#### **General Chat**
- Describe your API or testing requirements in natural language
- Example: "Create a test suite for a user registration API with email validation"

#### **cURL Commands**
- Paste cURL commands to automatically generate API test suites
- Example:
```bash
curl -X POST https://api.example.com/users \
  -H "Content-Type: application/json" \
  -d '{"name":"John","email":"john@example.com"}'
```

#### **Swagger/OpenAPI**
- Upload Swagger JSON/YAML files or paste specification content
- Automatically generates comprehensive test suites for all endpoints

#### **UI Test Steps**
- Describe UI test scenarios in natural language
- Example: "Navigate to login page, enter credentials, click login, verify dashboard"

### 3. Generated Output
- AI generates JSON test suites compatible with TestFlow Pro
- Preview the generated suite before saving
- Save directly to your testData folder

## 🔧 Configuration

### Model Selection
Edit `/src/ai-service.ts` to change the AI model:
```typescript
this.llm = new ChatOllama({
  baseUrl: 'http://localhost:11434',
  model: 'llama3.1:8b' // Change this to your preferred model
})
```

### RAG Knowledge Base
The system uses LangChain's RAG implementation:
- **Vector Store**: MemoryVectorStore with Ollama embeddings
- **Knowledge Base**: Framework docs + existing test suite examples
- **Context Retrieval**: Similarity search for relevant examples
- **Learning**: New generated suites are added to knowledge base

## 📊 Supported Test Types

### API Tests
- REST endpoints (GET, POST, PUT, DELETE)
- Request headers and body
- Response assertions
- Status code validation
- JSONPath-based assertions
- Variable storage and injection

### UI Tests
- Playwright-compatible test steps
- Navigation, clicks, typing, assertions
- CSS selectors and locators
- Wait conditions
- Page object patterns

## 🛠 Advanced Features

### Preprocessing Functions
AI can generate tests with preprocessing functions:
- `faker.email`, `faker.uuid`, `faker.username`
- `date.now`, `encrypt`, `custom.authToken`
- `dbQuery` with database integration

### Assertion Types
Supports all TestFlow Pro assertion types:
- `statusCode`, `equals`, `contains`, `exists`
- `regex`, `type`, `length`, `size`
- `greaterThan`, `lessThan`, `in`, `notIn`
- `arrayObjectMatch` for complex validations

## 🔍 Example Outputs

### API Test Suite
```json
{
  "suiteName": "User API Suite",
  "baseUrl": "https://api.example.com",
  "type": "API",
  "tags": [
    {"serviceName": "@UserService"},
    {"suiteType": "@smoke"}
  ],
  "testCases": [{
    "name": "Create User",
    "testData": [{
      "name": "Create New User",
      "method": "POST",
      "endpoint": "/users",
      "headers": {"Content-Type": "application/json"},
      "body": {"name": "John", "email": "john@example.com"},
      "assertions": [
        {"type": "statusCode", "expected": 201},
        {"type": "exists", "jsonPath": "$.id"}
      ]
    }]
  }]
}
```

### UI Test Suite
```json
{
  "suiteName": "Login Flow Test",
  "type": "UI",
  "tags": [
    {"testType": "@ui"},
    {"suiteType": "@smoke"}
  ],
  "testCases": [{
    "name": "User Login Flow",
    "testSteps": [
      {"action": "navigate", "value": "/login", "description": "Navigate to login page"},
      {"action": "type", "selector": "input[name='email']", "value": "test@example.com"},
      {"action": "type", "selector": "input[name='password']", "value": "password123"},
      {"action": "click", "selector": "button[type='submit']"},
      {"action": "assert", "selector": "h1", "value": "Dashboard", "type": "text"}
    ]
  }]
}
```

## 🚨 Troubleshooting

### Ollama Connection Issues
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Restart Ollama service
ollama serve
```

### Model Not Found
```bash
# List available models
ollama list

# Pull required model
ollama pull llama3.1:8b
```

### Memory Issues
- Use smaller models like `llama3.2:3b` for systems with limited RAM
- Ensure at least 8GB RAM for `llama3.1:8b`
- Close other applications to free up memory

## 🔮 Future Enhancements

- **ChromaDB Integration**: Persistent vector database for enhanced RAG
- **Advanced Embeddings**: Custom embeddings trained on TestFlow Pro patterns
- **Multi-model Support**: Support for different AI providers (OpenAI, Anthropic)
- **Test Data Generation**: AI-powered realistic test data creation
- **Performance Testing**: Load test scenario generation
- **API Documentation**: Automatic documentation generation from test suites
- **Continuous Learning**: Feedback loop to improve generation quality

## 📝 Notes

- AI-generated test suites should be reviewed before execution
- The AI learns from TestFlow Pro's existing patterns and best practices
- Generated tests follow the same structure as manually created suites
- All AI processing happens locally for privacy and security