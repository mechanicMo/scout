import React from 'react'
import { View, Text, StyleSheet } from 'react-native'

export function WatchlistScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Watchlist</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#100a04', alignItems: 'center', justifyContent: 'center' },
  text: { color: '#fff1e6', fontSize: 16 },
})
