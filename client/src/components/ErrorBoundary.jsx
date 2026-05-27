import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-fide-900">
          <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-8 max-w-md shadow-lg text-center">
            <p className="text-4xl mb-3">⚠️</p>
            <h2 className="text-lg font-bold mb-2 dark:text-white">Algo salió mal</h2>
            <p className="text-sm text-gray-500 dark:text-fide-300 mb-4">{this.state.error.message}</p>
            <button onClick={() => { this.setState({ error: null }); window.location.href = '/'; }} className="bg-fide-700 hover:bg-fide-800 text-white px-4 py-2 rounded-lg text-sm">
              Volver al inicio
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
