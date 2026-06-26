import { renderNotificationTemplate } from "../utils/templateEngine.js";

function run() {
  const user = {
    name: "Joelson Veras dos Santos",
    birthDate: new Date("1992-06-25T00:00:00Z"),
    neighborhood: "Santos Dumont",
    community: "Centro",
  };

  const titleTemplate = "🎉 Feliz aniversário, {{primeiroNome}}!";
  const bodyTemplate = "Olá, {{nome}}!\nSua idade: {{idade}}\nBairro: {{bairro}}\nComunidade: {{comunidade}}\nDia: {{dia}}\nMês: {{mes}}";

  console.log("=== TESTE DE TEMPLATE ===");
  console.log("TÍTULO:");
  console.log(renderNotificationTemplate(user, titleTemplate));
  console.log("\nMENSAGEM:");
  console.log(renderNotificationTemplate(user, bodyTemplate));
}

run();
