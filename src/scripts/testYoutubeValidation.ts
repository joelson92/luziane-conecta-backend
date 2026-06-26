import { extractYoutubeVideoId } from "../utils/youtube.js";

async function run() {
  console.log("=== INICIANDO TESTES DE VALIDAÇÃO DE URL DE YOUTUBE ===");

  const testCases = [
    // Casos Válidos
    {
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      expected: "dQw4w9WgXcQ",
      name: "Standard URL with www"
    },
    {
      url: "https://youtu.be/dQw4w9WgXcQ",
      expected: "dQw4w9WgXcQ",
      name: "Shortened URL youtu.be"
    },
    {
      url: "https://youtube.com/shorts/dQw4w9WgXcQ",
      expected: "dQw4w9WgXcQ",
      name: "YouTube Shorts URL"
    },
    {
      url: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      expected: "dQw4w9WgXcQ",
      name: "Embed URL"
    },
    {
      url: "https://www.youtube.com/watch?feature=youtu.be&v=dQw4w9WgXcQ&t=10",
      expected: "dQw4w9WgXcQ",
      name: "Watch URL with extra parameters"
    },
    {
      url: "https://youtu.be/dQw4w9WgXcQ?t=43",
      expected: "dQw4w9WgXcQ",
      name: "Shortened URL with parameters"
    },
    {
      url: "youtube.com/watch?v=dQw4w9WgXcQ",
      expected: "dQw4w9WgXcQ",
      name: "No protocol watch URL"
    },

    // Casos Inválidos
    {
      url: "npm install react-native-webview",
      expected: null,
      name: "Installation command"
    },
    {
      url: "teste",
      expected: null,
      name: "Simple text"
    },
    {
      url: "youtube",
      expected: null,
      name: "Single word domain name"
    },
    {
      url: "https://www.google.com",
      expected: null,
      name: "Different domain URL"
    },
    {
      url: "texto qualquer com link https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      expected: null,
      name: "Text surrounding valid URL"
    },
    {
      url: "https://youtube.com/watch",
      expected: null,
      name: "Watch URL missing ID parameter"
    },
    {
      url: "https://youtube.com/shorts/",
      expected: null,
      name: "Shorts URL missing ID"
    }
  ];

  let failedCount = 0;

  for (const tc of testCases) {
    const result = extractYoutubeVideoId(tc.url);
    if (result === tc.expected) {
      console.log(`🟢 PASSED: "${tc.name}" -> URL: "${tc.url}" -> ID: ${result}`);
    } else {
      console.error(`🔴 FAILED: "${tc.name}" -> URL: "${tc.url}" -> Esperado: ${tc.expected}, Recebeu: ${result}`);
      failedCount++;
    }
  }

  if (failedCount === 0) {
    console.log("\n🟢 TODOS OS TESTES DE VALIDAÇÃO DE URL DO YOUTUBE PASSARAM!");
  } else {
    console.error(`\n🔴 FALHA: ${failedCount} teste(s) falhou/falharam.`);
    process.exit(1);
  }
}

run().catch(console.error);
