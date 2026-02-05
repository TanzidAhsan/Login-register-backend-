import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes.js";
import transactionRoutes from "./routes/transaction.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import summaryRoutes from "./routes/summary.routes.js";
import mealRoutes from "./routes/meal.routes.js";



const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow localhost on any port
      if (!origin || origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/summary", summaryRoutes);
app.use("/api/meals", mealRoutes);



app.get("/", (req, res) => {
  res.send("API is running...");
});

export default app;
