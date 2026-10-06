import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null, isChunkError: false }; }
  static getDerivedStateFromError(error) {
    const msg = String(error?.message || error);
    const isChunkError =
      /failed to fetch dynamically imported module|loading chunk \d+ failed|importing a module script failed/i.test(msg);
    return { error, isChunkError };
  }
  componentDidCatch(error) {
    // Stale-deploy chunk error that escaped lazyWithReload (e.g. preload or
    // render path): force one hard reload to fetch the fresh bundle.
    if (this.state.isChunkError && !sessionStorage.getItem('chunk-reload')) {
      sessionStorage.setItem('chunk-reload', '1');
      window.location.reload();
    }
  }
  render() {
    if (this.state.error) {
      const reload = () => {
        sessionStorage.removeItem('chunk-reload');
        window.location.reload();
      };
      return (
        <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-fide-900">
          <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-8 max-w-md shadow-lg text-center">
            <p className="text-4xl mb-3">⚠️</p>
            <h2 className="text-lg font-bold mb-2 dark:text-white">Algo salió mal</h2>
            <p className="text-sm text-gray-500 dark:text-fide-300 mb-4">{this.state.isChunkError
              ? 'Hay una nueva versión disponible. Recarga para continuar.'
              : this.state.error.message}</p>
            <button onClick={reload} className="bg-fide-700 hover:bg-fide-800 text-white px-4 py-2 rounded-lg text-sm">
              {this.state.isChunkError ? 'Recargar página' : 'Volver al inicio'}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
