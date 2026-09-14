import { Component } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";

/** Isola erros de render numa parte da árvore — sem isso, qualquer exceção
 * (ex: dado malformado vindo do Firestore) derruba o app INTEIRO, deixando
 * a pessoa numa tela branca sem conseguir nem trocar de aba. Com isto, só
 * o pedaço quebrado mostra um aviso, e o resto do app continua usável. */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { erro: null };
  }

  static getDerivedStateFromError(erro) {
    return { erro };
  }

  componentDidCatch(erro, info) {
    console.error("Erro capturado pelo ErrorBoundary:", erro, info?.componentStack);
  }

  render() {
    if (this.state.erro) {
      return (
        <div className="card p-6 text-center max-w-md mx-auto my-6">
          <AlertTriangle size={26} className="mx-auto text-amber-500 mb-2" />
          <p className="text-sm font-semibold text-ink-900">{this.props.titulo || "Algo deu errado aqui"}</p>
          <p className="text-xs text-ink-500 mt-1">
            {this.props.mensagem || "Essa parte da tela encontrou um problema inesperado — o resto do sistema continua funcionando normalmente."}
          </p>
          <button
            onClick={() => this.setState({ erro: null })}
            className="flex items-center gap-1.5 mx-auto mt-3 text-xs font-semibold text-brand-600 hover:text-brand-700 focus-ring"
          >
            <RefreshCcw size={12} /> Tentar de novo
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
