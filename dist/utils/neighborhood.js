export function normalizeNeighborhoodName(value) {
    let normalized = String(value ?? "")
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();
    if (normalized === "medice" ||
        normalized === "medici" ||
        normalized === "presidente medice" ||
        normalized === "presidente medici") {
        return "medice";
    }
    return normalized;
}
export function displayNeighborhoodName(value) {
    const trimmed = String(value ?? "").trim().replace(/\s+/g, " ");
    if (!trimmed)
        return "";
    return trimmed
        .split(" ")
        .map((part) => part.charAt(0).toLocaleUpperCase("pt-BR") + part.slice(1).toLocaleLowerCase("pt-BR"))
        .join(" ");
}
