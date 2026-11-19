import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SUBSCRIPTION_PLANS } from '../../services/subscription-service';

interface SubscriptionModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectPlan: (plan: 'basic' | 'premium') => void;
  currentPlan: 'free' | 'basic' | 'premium';
}

const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  visible,
  onClose,
  onSelectPlan,
  currentPlan
}) => {
  const renderPlanCard = (plan: 'basic' | 'premium') => {
    const planDetails = SUBSCRIPTION_PLANS[plan];
    const isCurrentPlan = currentPlan === plan;

    return (
      <TouchableOpacity
        style={[
          styles.planCard,
          isCurrentPlan && styles.currentPlanCard
        ]}
        onPress={() => !isCurrentPlan && onSelectPlan(plan)}
        disabled={isCurrentPlan}
      >
        <View style={styles.planHeader}>
          <Text style={styles.planName}>{planDetails.name}</Text>
          <Text style={styles.planPrice}>${planDetails.price}/month</Text>
        </View>
        
        <View style={styles.planFeatures}>
          {planDetails.features.map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={20} color="#FF6B35" />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>

        <View style={styles.planFooter}>
          <Text style={[
            styles.planButton,
            isCurrentPlan && styles.currentPlanButton
          ]}>
            {isCurrentPlan ? 'Current Plan' : 'Upgrade Now'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Upgrade Your Experience</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.plansContainer}>
            <Text style={styles.subtitle}>Choose a plan that&apos;s right for you</Text>
            {renderPlanCard('basic')}
            {renderPlanCard('premium')}
          </ScrollView>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              * All plans include access to our growing collection of cultural food guides
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    minHeight: '80%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  plansContainer: {
    flex: 1,
  },
  planCard: {
    backgroundColor: '#f8f8f8',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#eee',
  },
  currentPlanCard: {
    borderColor: '#FF6B35',
  },
  planHeader: {
    marginBottom: 15,
  },
  planName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  planPrice: {
    fontSize: 24,
    color: '#FF6B35',
    fontWeight: 'bold',
  },
  planFeatures: {
    marginBottom: 20,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  featureText: {
    marginLeft: 10,
    fontSize: 16,
    color: '#666',
  },
  planFooter: {
    alignItems: 'center',
  },
  planButton: {
    backgroundColor: '#FF6B35',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    overflow: 'hidden',
  },
  currentPlanButton: {
    backgroundColor: '#ccc',
  },
  footer: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  footerText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});

export default SubscriptionModal;
