import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../navigation/MainNavigator'

type Props = NativeStackScreenProps<RootStackParamList, 'MediaDetail'>

export function MediaDetailScreen({ route, navigation }: Props) {
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.text}>Media ID: {route.params.tmdbId}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#100a04', paddingTop: 60, paddingHorizontal: 16 },
  back: { marginBottom: 24 },
  backText: { color: '#e8a020', fontSize: 15, fontWeight: '600' },
  text: { color: '#fff1e6', fontSize: 16 },
})
