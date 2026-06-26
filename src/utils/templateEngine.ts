/**
 * Motor de Templates Simples para personalização de mensagens
 */

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

function calculateAge(birthDate: string | Date): number | "" {
  if (!birthDate) return "";
  const birth = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export function renderNotificationTemplate(user: any, text: string): string {
  if (!text) return "";

  const name = user.name || "";
  const primeiroNome = name.split(" ")[0] || "";
  
  const idade = user.birthDate ? calculateAge(user.birthDate).toString() : "";
  const bairro = user.neighborhoodName || user.neighborhood || "";
  const comunidade = user.community || "";
  
  let dia = "";
  let mes = "";
  if (user.birthDate) {
    const d = new Date(user.birthDate);
    dia = d.getUTCDate().toString().padStart(2, "0");
    mes = MONTH_NAMES[d.getUTCMonth()];
  }

  const variables: Record<string, string> = {
    nome: name,
    primeiroNome,
    idade,
    bairro,
    comunidade,
    dia,
    mes
  };

  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, variable) => {
    return variables[variable] !== undefined ? variables[variable] : match;
  });
}
