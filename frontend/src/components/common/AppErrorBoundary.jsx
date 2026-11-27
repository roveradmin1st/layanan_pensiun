import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || "Terjadi kendala saat menampilkan halaman."
    };
  }

  componentDidCatch(error, info) {
    if (typeof console !== "undefined" && typeof console.error === "function") {
      console.error("[AppErrorBoundary]", error, info?.componentStack || "");
    }
  }

  handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  handleReset = () => {
    this.setState({ hasError: false, errorMessage: "" });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10"
        data-testid="app-error-boundary"
      >
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h1 className="mt-4 font-display text-lg font-bold text-[#17223B]">
            Halaman Perlu Dimuat Ulang
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            Aplikasi mengalami gangguan tampilan sementara atau baru saja diperbarui di server.
            Data yang sudah tersimpan di sistem tetap aman.
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={this.handleReload}
              data-testid="error-boundary-reload"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#351080] px-4 text-xs font-bold text-white hover:bg-[#5720B8]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Muat Ulang Aplikasi
            </button>
            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Coba Lanjutkan
            </button>
          </div>
        </div>
      </div>
    );
  }
}
