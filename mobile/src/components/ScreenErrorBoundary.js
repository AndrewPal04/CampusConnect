import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../theme';

class ScreenErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
    };
    this.handleRetry = this.handleRetry.bind(this);
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || 'An unexpected screen error occurred.',
    };
  }

  componentDidCatch(error, info) {
    console.error('[ScreenErrorBoundary]', this.props.screenName, error, info);
  }

  handleRetry() {
    this.setState({ hasError: false, errorMessage: '' });
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.subtitle}>
            {this.props.screenName || 'This screen'} hit an unexpected error.
          </Text>
          <Text style={styles.message}>{this.state.errorMessage}</Text>
          <TouchableOpacity onPress={this.handleRetry} style={styles.button}>
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    color: COLORS.ink,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    color: '#555',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    color: '#777',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
  },
  button: {
    backgroundColor: COLORS.blue,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  buttonText: {
    color: COLORS.cream,
    fontSize: 13,
    fontWeight: '700',
  },
});

export default ScreenErrorBoundary;
