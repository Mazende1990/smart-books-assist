import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { FileText, Loader2, Plus, Receipt, Upload } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { StatusBadge } from "@/components/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatMoney } from "@/lib/format";
import { createDocument, listDocuments } from "@/lib/accounting.functions";

export const Route = createFileRoute("/app/documents")({
  component: DocumentsPage,
});

const KIND_LABELS: Record<string, string> = {
  supplier_invoice: "Supplier invoice",
  customer_invoice: "Customer invoice",
  receipt: "Receipt",
  other: "Other",
};

const TABS = [
  { value: "all", label: "All" },
  { value: "supplier_invoice", label: "Supplier invoices" },
  { value: "customer_invoice", label: "Customer invoices" },
  { value: "receipt", label: "Receipts" },
  { value: "other", label: "Other" },
];

const schema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  kind: z.enum(["supplier_invoice", "customer_invoice", "receipt", "other"]),
  counterparty: z.string().max(200).optional(),
  documentNumber: z.string().max(80).optional(),
  issueDate: z.string().optional(),
  totalInclVat: z.string().optional(),
  vatAmount: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

function DocumentsPage() {
  const [tab, setTab] = useState("all");
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const queryClient = useQueryClient();

  const query = useQuery({ queryKey: ["documents"], queryFn: () => listDocuments() });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { kind: "supplier_invoice" },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      createDocument({
        data: {
          title: values.title,
          kind: values.kind,
          counterparty: values.counterparty || undefined,
          documentNumber: values.documentNumber || undefined,
          issueDate: values.issueDate || undefined,
          totalInclVat: values.totalInclVat ? Number(values.totalInclVat) : undefined,
          vatAmount: values.vatAmount ? Number(values.vatAmount) : undefined,
          mimeType: file?.type,
          fileSize: file?.size,
        },
      }),
    onSuccess: () => {
      toast.success("Document added.");
      setOpen(false);
      reset();
      setFile(null);
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not save document."),
  });

  const currency = query.data?.currency ?? "SEK";
  const documents = (query.data?.documents ?? []).filter((d) => tab === "all" || d.kind === tab);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Documents</h1>
          <p className="text-sm text-muted-foreground">
            Supplier invoices, customer invoices, receipts and other accounting documents.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus /> Upload document
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload document</DialogTitle>
              <DialogDescription>
                Stores document metadata now. Parsing/OCR of the file itself isn't wired up yet.
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={handleSubmit((values) => mutation.mutate(values))}
              className="space-y-4"
              noValidate
            >
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" placeholder="AWS hosting invoice" {...register("title")} />
                {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Kind</Label>
                  <Select
                    defaultValue="supplier_invoice"
                    onValueChange={(v) => setValue("kind", v as FormValues["kind"])}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(KIND_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="documentNumber">Document number</Label>
                  <Input id="documentNumber" {...register("documentNumber")} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="counterparty">Counterparty</Label>
                  <Input id="counterparty" {...register("counterparty")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="issueDate">Issue date</Label>
                  <Input id="issueDate" type="date" {...register("issueDate")} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="totalInclVat">Total incl. VAT</Label>
                  <Input
                    id="totalInclVat"
                    type="number"
                    step="0.01"
                    {...register("totalInclVat")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vatAmount">VAT amount</Label>
                  <Input id="vatAmount" type="number" step="0.01" {...register("vatAmount")} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="file">File (optional, metadata only for now)</Label>
                <Input
                  id="file"
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending && <Loader2 className="animate-spin" />}
                  <Upload /> Save document
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {query.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-sm text-muted-foreground">
            <FileText className="size-8" />
            No documents in this category yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => (
            <Card key={doc.id}>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Receipt className="size-3.5" /> {KIND_LABELS[doc.kind]}
                  </div>
                  <StatusBadge status={doc.status} />
                </div>
                <p className="truncate font-medium">{doc.title}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {doc.counterparty ?? "—"} {doc.documentNumber ? `· ${doc.documentNumber}` : ""}
                </p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {doc.issueDate ? formatDate(doc.issueDate) : "—"}
                  </span>
                  <span className="numeric font-medium">
                    {doc.totalInclVat !== null ? formatMoney(doc.totalInclVat, currency) : "—"}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
