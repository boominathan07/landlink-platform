import { Component } from 'react'
import { Button } from './ui/button'

export class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="p-8 text-center">
          <h2 className="text-lg font-semibold text-text mb-2">Something went wrong</h2>
          <p className="text-sm text-muted mb-4">{this.state.error.message}</p>
          <Button onClick={() => window.location.reload()}>Reload page</Button>
        </div>
      )
    }
    return this.props.children
  }
}
