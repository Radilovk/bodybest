declare var crypto: Crypto;

interface ExtraMeal {
  foodDescription?: string;
  quantityEstimate?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  [key: string]: unknown;
}

interface UserLogEntry {
  /** ISO датата на записа (YYYY-MM-DD). */
  date: string;
  /** Данни за дневника – бележки, показатели и др. */
  data: Record<string, unknown>;
  /** Обобщени макроси или други тотали. */
  totals: Record<string, number> | null;
  /** Списък с извънредни хранения за деня. */
  extraMeals: ExtraMeal[];
}

