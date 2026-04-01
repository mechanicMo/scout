import { View, StyleSheet } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { RootNavigator } from './src/navigation/RootNavigator'

export default function App() {
  return (
    <View style={styles.root}>
      <RootNavigator />
      <StatusBar style="light" />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#100a04' },
})
