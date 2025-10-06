import express from "express";
import cors from "cors";
import routes from "./routes";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api", routes);

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`[api] listening on ${port}`));
