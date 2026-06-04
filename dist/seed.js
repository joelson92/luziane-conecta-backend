import bcrypt from "bcryptjs";
import { connectDatabase } from "./config/db.js";
import { Demand, Event, Neighborhood, Post, Survey, User } from "./models/index.js";
async function upsertUser(email, password, data) {
    const passwordHash = await bcrypt.hash(password, 12);
    await User.updateOne({ email }, { $set: { ...data, email, passwordHash, isActive: true } }, { upsert: true });
}
await connectDatabase();
await upsertUser("admin@luzianeconecta.com", "Admin@123456", {
    name: "Super Admin",
    role: "SUPER_ADMIN",
    phone: "00000000000"
});
await upsertUser("luziane@luzianeconecta.com", "Luziane@123456", {
    name: "Prefeita Luziane",
    role: "PREFEITA",
    phone: "00000000001",
    neighborhood: "Centro",
    city: "Benevides",
    state: "PA",
    country: "Brasil",
    latitude: -1.3619,
    longitude: -48.2447,
    geocodingStatus: "success",
    geocodingProvider: "seed"
});
const neighborhoods = [
    { name: "Centro", communities: ["Centro Comercial", "Praca Matriz"], centerLat: -1.3619, centerLng: -48.2447 },
    { name: "Murinin", communities: ["Murinin", "Estrada do Murinin"], centerLat: -1.2826, centerLng: -48.3142 },
    { name: "Santa Maria", communities: ["Santa Maria", "Canavial"], centerLat: -1.3402, centerLng: -48.2708 },
    { name: "Maguari", communities: ["Maguari", "Jaburu"], centerLat: -1.3923, centerLng: -48.2321 },
    { name: "Benfica", communities: ["Benfica", "Distrito Industrial"], centerLat: -1.4172, centerLng: -48.2036 },
    { name: "Parque Verde", communities: ["Parque Verde", "Residencial"], centerLat: -1.3553, centerLng: -48.2291 }
];
for (const neighborhood of neighborhoods) {
    await Neighborhood.updateOne({ name: neighborhood.name }, { $set: { ...neighborhood, isActive: true } }, { upsert: true });
}
await Post.updateOne({ title: "Mensagem da Prefeita" }, {
    $set: {
        category: "AVISOS",
        title: "Mensagem da Prefeita",
        content: "Este e o canal oficial para ouvir voce e cuidar melhor da nossa cidade.",
        isPublished: true,
        publishedAt: new Date()
    }
}, { upsert: true });
await Event.updateOne({ title: "Reuniao comunitaria" }, {
    $set: {
        title: "Reuniao comunitaria",
        description: "Escuta publica com moradores.",
        locationName: "Centro comunitario",
        neighborhood: "Centro",
        location: { lat: -1.3619, lng: -48.2447 },
        startDate: new Date(),
        isPublished: true
    }
}, { upsert: true });
await Survey.updateOne({ title: "Qual deve ser a proxima obra prioritaria?" }, {
    $set: {
        title: "Qual deve ser a proxima obra prioritaria?",
        description: "Ajude a definir a prioridade da gestao.",
        options: [{ label: "Pavimentacao", votes: [] }, { label: "Saude", votes: [] }, { label: "Educacao", votes: [] }],
        isActive: true
    }
}, { upsert: true });
const citizen = await User.findOne({ role: "CIDADAO" });
if (citizen) {
    await Demand.updateOne({ title: "Iluminacao da rua" }, {
        $set: {
            citizenId: citizen._id,
            type: "PEDIDO",
            title: "Iluminacao da rua",
            description: "Solicitacao de reparo na iluminacao publica.",
            neighborhood: citizen.get("neighborhood") ?? "Centro",
            status: "RECEBIDO"
        }
    }, { upsert: true });
}
console.log("Seed completed");
process.exit(0);
