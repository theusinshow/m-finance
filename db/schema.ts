import {
  boolean,
  check,
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const monthStatus = pgEnum("month_status", ["open", "closed", "archived"]);
export const incomeType = pgEnum("income_type", ["main", "extra", "freelance"]);
export const billStatus = pgEnum("bill_status", ["pending", "paid", "overdue"]);
export const cardType = pgEnum("card_type", ["personal", "business"]);
export const invoiceStatus = pgEnum("invoice_status", ["pending", "paid", "overdue"]);
export const alertType = pgEnum("alert_type", [
  "due_in_3_days",
  "due_today",
  "overdue",
  "month_review",
]);
export const alertEntityType = pgEnum("alert_entity_type", ["bill", "invoice", "month"]);
export const alertSeverity = pgEnum("alert_severity", ["info", "warning", "danger"]);
export const monthHealth = pgEnum("month_health", ["positive", "fair", "tight", "negative"]);
export const paymentType = pgEnum("payment_type", ["cash", "installment"]);
export const riskLevel = pgEnum("risk_level", ["safe", "controlled", "tight", "critical"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  supabaseUserId: uuid("supabase_user_id").notNull().unique(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  avatarUrl: text("avatar_url"),
  ...timestamps,
});

export const months = pgTable(
  "months",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    month: integer("month").notNull(),
    year: integer("year").notNull(),
    status: monthStatus("status").notNull().default("open"),
    ...timestamps,
  },
  (table) => [
    unique("months_user_month_year_unique").on(table.userId, table.month, table.year),
    check("months_month_range", sql`${table.month} between 1 and 12`),
    check("months_year_min", sql`${table.year} >= 2020`),
  ],
);

export const incomes = pgTable(
  "incomes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    monthId: uuid("month_id").notNull().references(() => months.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    amountCents: integer("amount_cents").notNull(),
    incomeType: incomeType("income_type").notNull(),
    expectedDate: date("expected_date"),
    received: boolean("received").notNull().default(false),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [check("incomes_amount_positive", sql`${table.amountCents} > 0`)],
);

export const billCategories = pgTable(
  "bill_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    color: text("color"),
    icon: text("icon"),
    isDefault: boolean("is_default").notNull().default(false),
    isArchived: boolean("is_archived").notNull().default(false),
    ...timestamps,
  },
  (table) => [unique("bill_categories_user_slug_unique").on(table.userId, table.slug)],
);

export const recurrenceRules = pgTable(
  "recurrence_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    categoryId: uuid("category_id").references(() => billCategories.id, { onDelete: "set null" }),
    defaultAmountCents: integer("default_amount_cents"),
    dueDay: integer("due_day").notNull(),
    isVariableAmount: boolean("is_variable_amount").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    check("recurrence_rules_due_day_range", sql`${table.dueDay} between 1 and 31`),
    check(
      "recurrence_rules_default_amount_positive",
      sql`${table.defaultAmountCents} is null or ${table.defaultAmountCents} > 0`,
    ),
  ],
);

export const bills = pgTable(
  "bills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    monthId: uuid("month_id").notNull().references(() => months.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => billCategories.id, { onDelete: "set null" }),
    recurrenceRuleId: uuid("recurrence_rule_id").references(() => recurrenceRules.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    amountCents: integer("amount_cents").notNull(),
    dueDate: date("due_date").notNull(),
    isRecurring: boolean("is_recurring").notNull().default(false),
    status: billStatus("status").notNull().default("pending"),
    notes: text("notes"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [check("bills_amount_positive", sql`${table.amountCents} > 0`)],
);

export const creditCards = pgTable(
  "credit_cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    cardType: cardType("card_type").notNull().default("personal"),
    dueDay: integer("due_day").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (table) => [check("credit_cards_due_day_range", sql`${table.dueDay} between 1 and 31`)],
);

export const creditCardInvoices = pgTable(
  "credit_card_invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    cardId: uuid("card_id").notNull().references(() => creditCards.id, { onDelete: "cascade" }),
    monthId: uuid("month_id").notNull().references(() => months.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(),
    dueDate: date("due_date").notNull(),
    status: invoiceStatus("status").notNull().default("pending"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    unique("credit_card_invoices_card_month_unique").on(table.cardId, table.monthId),
    check("credit_card_invoices_amount_positive", sql`${table.amountCents} > 0`),
  ],
);

export const alerts = pgTable("alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  monthId: uuid("month_id").references(() => months.id, { onDelete: "cascade" }),
  alertType: alertType("alert_type").notNull(),
  entityType: alertEntityType("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  severity: alertSeverity("severity").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  triggerDate: date("trigger_date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const monthlySnapshots = pgTable("monthly_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  monthId: uuid("month_id").notNull().references(() => months.id, { onDelete: "cascade" }),
  totalIncomeCents: integer("total_income_cents").notNull(),
  totalBillsCents: integer("total_bills_cents").notNull(),
  totalInvoicesCents: integer("total_invoices_cents").notNull(),
  totalPaidCents: integer("total_paid_cents").notNull(),
  totalPendingCents: integer("total_pending_cents").notNull(),
  totalOverdueCents: integer("total_overdue_cents").notNull(),
  estimatedRemainingCents: integer("estimated_remaining_cents").notNull(),
  monthHealth: monthHealth("month_health").notNull(),
  ...timestamps,
});

export const purchaseSimulations = pgTable(
  "purchase_simulations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    totalAmountCents: integer("total_amount_cents").notNull(),
    paymentType: paymentType("payment_type").notNull(),
    installments: integer("installments"),
    startMonth: integer("start_month").notNull(),
    startYear: integer("start_year").notNull(),
    monthlyImpactCents: integer("monthly_impact_cents").notNull(),
    riskLevel: riskLevel("risk_level").notNull(),
    recommendation: text("recommendation").notNull(),
    resultPayload: jsonb("result_payload").notNull(),
    ...timestamps,
  },
  (table) => [
    check("purchase_simulations_total_positive", sql`${table.totalAmountCents} > 0`),
    check("purchase_simulations_start_month_range", sql`${table.startMonth} between 1 and 12`),
    check(
      "purchase_simulations_installments_valid",
      sql`${table.installments} is null or ${table.installments} >= 1`,
    ),
  ],
);

export const settings = pgTable("settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  alertDaysBefore: integer("alert_days_before").notNull().default(3),
  theme: text("theme").notNull().default("dark"),
  currency: text("currency").notNull().default("BRL"),
  ...timestamps,
});

export type BillStatus = (typeof billStatus.enumValues)[number];
export type InvoiceStatus = (typeof invoiceStatus.enumValues)[number];
export type MonthHealth = (typeof monthHealth.enumValues)[number];
export type PaymentType = (typeof paymentType.enumValues)[number];
export type RiskLevel = (typeof riskLevel.enumValues)[number];
